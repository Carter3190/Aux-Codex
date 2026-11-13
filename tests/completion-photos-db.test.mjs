import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root=new URL("../",import.meta.url);
const migration=name=>readFile(new URL(`supabase/migrations/${name}`,root),"utf8");
const customer="30000000-0000-4000-8000-000000000001";
const otherCustomer="30000000-0000-4000-8000-000000000002";
const provider="30000000-0000-4000-8000-000000000003";
const otherProvider="30000000-0000-4000-8000-000000000004";
const admin="30000000-0000-4000-8000-000000000005";
const bucket="booking-completion-photos";

async function database(){
  const db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;create schema private;create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table profiles(id uuid primary key,role text,provider_status text);
    grant select on profiles to authenticated;
    create table provider_credentials(provider_id uuid,document_path text);
    grant select on provider_credentials to authenticated;
    create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
    create function private.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
    grant usage on schema auth,private,storage to anon,authenticated,service_role;
    create table booking_requests(id uuid primary key,customer_id uuid references profiles,provider_id uuid references profiles,status text default 'accepted',requested_date date default current_date,customer_name text default 'Customer',service_name text default 'Service');
    create table booking_messages(id uuid primary key default gen_random_uuid(),booking_id uuid references booking_requests,sender_id uuid references profiles,body text,created_at timestamptz default now());
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,metadata jsonb,updated_at timestamptz default now(),unique(bucket_id,name));
    create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,service_role;
    grant select on storage.objects to anon;
  `);
  for(const name of ["20260901020000_stripe_connect_payments.sql","20260910000000_booking_completion_reviews.sql","20261002000000_direct_charge_payments.sql","20261111000000_payment_after_service.sql"]){await db.exec(await migration(name));}
  // Install the actual existing Storage policies. PostgreSQL combines its
  // permissive policies with OR, so new isolation must hold alongside these.
  const onboarding=await migration("20260831000000_provider_onboarding.sql");
  await db.exec(onboarding.slice(onboarding.indexOf("insert into storage.buckets (")));
  const credentialRules=await migration("20261106000000_service_credential_reviews.sql");
  await db.exec(credentialRules.slice(credentialRules.indexOf('drop policy if exists "Providers delete their own credential files"'),credentialRules.indexOf("-- No existing provider status or booking history is changed.")));
  await db.query("insert into profiles(id,role,provider_status) values ($1,'customer',null),($2,'customer',null),($3,'provider','approved'),($4,'provider','approved'),($5,'admin',null)",[customer,otherCustomer,provider,otherProvider,admin]);
  await db.exec(await migration("20261113000000_booking_completion_photos.sql"));
  await db.exec(await migration("20261113010000_completion_photo_snapshot.sql"));
  return db;
}
async function as(db,id,action,role="authenticated"){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??""]);
  await db.exec(`set role ${role}`);
  try{return await action();}finally{await db.exec("reset role");}
}
async function booking(db,dayOffset=0,status="accepted"){
  const id=randomUUID();await db.query("insert into booking_requests(id,customer_id,provider_id,status,requested_date,agreed_price_cents) values($1,$2,$3,$4,current_date+$5::integer,12500)",[id,customer,provider,status,dayOffset]);return id;
}
async function photo(db,bookingId,who=provider,{size=100,type="image/png",fileId=randomUUID()}={}){
  const path=`${who}/${bookingId}/${fileId}.png`;
  const result=await as(db,who,()=>db.query("insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3) returning *",[bucket,path,{size,mimetype:type}]));
  return result.rows[0];
}
async function verify(db,bookingId,object,who=provider){
  return as(db,who,()=>db.query("select record_booking_completion_photo_verification($1,$2,$3,$4,$5,$6,$7)",[bookingId,who,object.name,object.id,object.updated_at,object.metadata.mimetype,object.metadata.size]),"service_role");
}
async function snapshot(db,bookingId,object,who=provider,role="service_role"){
  const result=await as(db,who,()=>db.query("select get_booking_completion_photo_snapshot($1,$2,$3,$4) as snapshot",[bookingId,who,object.name,object.id]),role);
  return result.rows[0].snapshot;
}
const complete=(db,id,paths=[],who=provider)=>as(db,who,()=>db.query("select complete_booking_with_photos($1,$2)",[id,paths]));
const saved=(db,id)=>db.query("select * from booking_completion_photos where booking_id=$1 order by position",[id]);

test("private completion images preserve payment flow and enforce RPC/storage ownership",async t=>{
  const db=await database();
  try{
    await t.test("private bucket is limited to supported 5MB image types",async()=>{
      const row=(await db.query("select * from storage.buckets where id=$1",[bucket])).rows[0];
      assert.equal(row.public,false);assert.equal(Number(row.file_size_limit),5242880);assert.deepEqual(row.allowed_mime_types,["image/jpeg","image/png","image/webp"]);
      const verificationTable=(await db.query("select relrowsecurity from pg_class where oid='private.booking_completion_photo_verifications'::regclass")).rows[0];
      assert.equal(verificationTable.relrowsecurity,true);
    });
    await t.test("optional empty photo list preserves existing completion and no charge",async()=>{
      const id=await booking(db);assert.equal((await complete(db,id)).rows[0].complete_booking_with_photos,true);
      assert.equal((await db.query("select status from booking_requests where id=$1",[id])).rows[0].status,"completed");
      assert.equal((await db.query("select count(*)::integer n from booking_payments where booking_id=$1",[id])).rows[0].n,0);
      assert.equal((await saved(db,id)).rows.length,0);
      assert.equal((await complete(db,id)).rows[0].complete_booking_with_photos,false);
    });
    await t.test("only owning provider may create/read/delete accepted booking drafts",async()=>{
      const id=await booking(db);const object=await photo(db,id);
      await assert.rejects(photo(db,id,otherProvider),/row-level security/);
      await assert.rejects(photo(db,id,customer),/row-level security/);
      assert.equal((await as(db,provider,()=>db.query("select * from storage.objects where id=$1",[object.id]))).rows.length,1);
      for(const who of [customer,otherCustomer,otherProvider,admin])assert.equal((await as(db,who,()=>db.query("select * from storage.objects where id=$1",[object.id]))).rows.length,0);
      assert.equal((await as(db,otherProvider,()=>db.query("delete from storage.objects where id=$1 returning id",[object.id]))).rows.length,0);
      assert.equal((await as(db,provider,()=>db.query("delete from storage.objects where id=$1 returning id",[object.id]))).rows.length,1);
      for(const path of [`${provider}/${id}/../x.png`,`${provider}/${id}/x.svg`,`${provider}/${id}/${randomUUID()}.svg`])await assert.rejects(as(db,provider,()=>db.query("insert into storage.objects(bucket_id,name) values($1,$2)",[bucket,path])),/row-level security/);
    });
    await t.test("direct RPC cannot attach an unverified or other booking's file",async()=>{
      const id=await booking(db);const object=await photo(db,id);
      await assert.rejects(complete(db,id,[object.name]),/must be verified/);
      await assert.rejects(as(db,provider,()=>db.query("select record_booking_completion_photo_verification($1,$2,$3,$4,$5,'image/png',100)",[id,provider,object.name,object.id,object.updated_at])),/permission denied/);
      await assert.rejects(as(db,provider,()=>db.query("insert into booking_completion_photos(booking_id,storage_object_id,storage_path,content_type,byte_size,position) values($1,$2,$3,'image/png',100,0)",[id,object.id,object.name])),/permission denied/);
      await assert.rejects(as(db,provider,()=>db.query("select * from private.booking_completion_photo_verifications")),/permission denied/);
      await verify(db,id,object);
      await assert.rejects(complete(db,await booking(db),[object.name]),/does not belong/);
      await assert.rejects(complete(db,id,[object.name],otherProvider),/not found/);
      await assert.rejects(complete(db,id,[object.name],customer),/Only provider/);
      assert.equal((await saved(db,id)).rows.length,0);
    });
    await t.test("five verified photos attach atomically and remain private after completion",async()=>{
      const id=await booking(db);const objects=[];
      for(let i=0;i<5;i++){const object=await photo(db,id);await verify(db,id,object);objects.push(object);}
      assert.equal((await complete(db,id,objects.map(o=>o.name))).rows[0].complete_booking_with_photos,true);
      assert.equal((await saved(db,id)).rows.length,5);
      assert.equal((await db.query("select count(*)::integer n from booking_payments where booking_id=$1",[id])).rows[0].n,0);
      for(const who of [provider,customer,admin]){
        assert.equal((await as(db,who,()=>saved(db,id))).rows.length,5);
        assert.equal((await as(db,who,()=>db.query("select * from storage.objects where id=$1",[objects[0].id]))).rows.length,1);
      }
      for(const who of [otherProvider,otherCustomer]){
        assert.equal((await as(db,who,()=>saved(db,id))).rows.length,0);
        assert.equal((await as(db,who,()=>db.query("select * from storage.objects where id=$1",[objects[0].id]))).rows.length,0);
      }
      assert.equal((await as(db,null,()=>db.query("select * from storage.objects where id=$1",[objects[0].id]),"anon")).rows.length,0);
      const before=(await db.query("select completed_at from booking_requests where id=$1",[id])).rows[0].completed_at;
      assert.equal((await complete(db,id,objects.map(o=>o.name))).rows[0].complete_booking_with_photos,false);
      assert.equal((await complete(db,id,[])).rows[0].complete_booking_with_photos,false);
      assert.deepEqual((await db.query("select completed_at from booking_requests where id=$1",[id])).rows[0].completed_at,before);
      await assert.rejects(complete(db,id,[objects[0].name]),/cannot be changed/);
      await assert.rejects(photo(db,id),/row-level security/);
      assert.equal((await as(db,provider,()=>db.query("delete from storage.objects where id=$1 returning id",[objects[0].id]))).rows.length,0);
      assert.equal((await as(db,provider,()=>db.query("update storage.objects set metadata='{}' where id=$1 returning id",[objects[0].id]))).rows.length,0);
      await assert.rejects(db.query("delete from storage.objects where id=$1",[objects[0].id]),/foreign key/);
    });
    await t.test("duplicate/six-photo lists and replaced or stale objects are rejected",async()=>{
      const id=await booking(db);const object=await photo(db,id);await verify(db,id,object);
      await assert.rejects(complete(db,id,[object.name,object.name]),/five different/);
      await assert.rejects(complete(db,id,Array.from({length:6},()=>`${provider}/${id}/${randomUUID()}.png`)),/five different/);
      await db.query("update private.booking_completion_photo_verifications set verified_at=now()-interval '16 minutes' where storage_object_id=$1",[object.id]);
      await assert.rejects(complete(db,id,[object.name]),/must be verified/);
      await verify(db,id,object);
      await as(db,provider,()=>db.query("delete from storage.objects where id=$1",[object.id]));
      const replacement=await photo(db,id,provider,{fileId:object.name.split('/')[2].slice(0,-4)});
      assert.notEqual(replacement.id,object.id);
      await assert.rejects(complete(db,id,[replacement.name]),/must be verified/);
    });
    await t.test("existing future-day guard rolls back all photo links and leaves payments untouched",async()=>{
      const id=await booking(db,1);const object=await photo(db,id);await verify(db,id,object);
      await assert.rejects(complete(db,id,[object.name]),/future booking/);
      assert.equal((await saved(db,id)).rows.length,0);
      assert.equal((await db.query("select status from booking_requests where id=$1",[id])).rows[0].status,"accepted");
      assert.equal((await db.query("select count(*)::integer n from booking_payments where booking_id=$1",[id])).rows[0].n,0);
    });
    await t.test("metadata size and MIME must match trusted byte validation",async()=>{
      const id=await booking(db);const object=await photo(db,id,provider,{size:5242881});
      await assert.rejects(verify(db,id,object),/could not be verified/);
      const normal=await photo(db,id);
      await assert.rejects(as(db,provider,()=>db.query("select record_booking_completion_photo_verification($1,$2,$3,$4,$5,'image/jpeg',100)",[id,provider,normal.name,normal.id,normal.updated_at]),"service_role"),/could not be verified/);
    });
    await t.test("exact snapshot preserves database microseconds lost by Storage's JavaScript timestamp",async()=>{
      const id=await booking(db);const original=await photo(db,id);
      await db.query("update storage.objects set updated_at='2026-11-13T21:00:00.123456Z' where id=$1",[original.id]);
      const object=(await db.query("select * from storage.objects where id=$1",[original.id])).rows[0];
      assert.equal(object.updated_at.toISOString(),"2026-11-13T21:00:00.123Z");
      await assert.rejects(verify(db,id,object),/could not be verified/);
      const exact=await snapshot(db,id,object);
      assert.equal(exact.id,object.id);assert.equal(exact.updated_at,"2026-11-13 21:00:00.123456+00");
      assert.equal(exact.content_type,"image/png");assert.equal(exact.byte_size,100);
      await verify(db,id,{...object,updated_at:exact.updated_at});
      assert.equal((await db.query("select object_updated_at::text as exact from private.booking_completion_photo_verifications where storage_object_id=$1",[object.id])).rows[0].exact,exact.updated_at);
      assert.equal((await complete(db,id,[object.name])).rows[0].complete_booking_with_photos,true);
      assert.equal((await saved(db,id)).rows.length,1);
      assert.equal((await db.query("select count(*)::integer n from booking_payments where booking_id=$1",[id])).rows[0].n,0);
    });
    await t.test("exact snapshot remains service-only and rejects mismatched ownership, booking, and object",async()=>{
      const id=await booking(db);const object=await photo(db,id);
      for(const role of ["anon","authenticated"]){
        await assert.rejects(snapshot(db,id,object,provider,role),/permission denied/);
      }
      await assert.rejects(snapshot(db,id,object,otherProvider),/does not belong/);
      await assert.rejects(snapshot(db,await booking(db),object),/does not belong/);
      await assert.rejects(snapshot(db,id,{...object,id:randomUUID()}),/could not be verified/);
      const foreign=await photo(db,await booking(db),provider);
      await assert.rejects(snapshot(db,id,{...object,id:foreign.id}),/could not be verified/);
      await db.query("update booking_requests set status='cancelled' where id=$1",[id]);
      await assert.rejects(snapshot(db,id,object),/does not belong/);
    });
    await t.test("a change of only one microsecond during byte verification or after attestation is still rejected",async()=>{
      const id=await booking(db);const object=await photo(db,id);
      await db.query("update storage.objects set updated_at='2026-11-13T21:00:00.123456Z' where id=$1",[object.id]);
      const beforeDownload=await snapshot(db,id,object);
      await db.query("update storage.objects set updated_at=updated_at+interval '1 microsecond' where id=$1",[object.id]);
      await assert.rejects(verify(db,id,{...object,updated_at:beforeDownload.updated_at}),/could not be verified/);
      assert.equal((await db.query("select count(*)::integer n from private.booking_completion_photo_verifications where storage_object_id=$1",[object.id])).rows[0].n,0);
      const refreshed=await snapshot(db,id,object);
      assert.equal(refreshed.updated_at,"2026-11-13 21:00:00.123457+00");
      await verify(db,id,{...object,updated_at:refreshed.updated_at});
      await db.query("update storage.objects set updated_at=updated_at+interval '1 microsecond' where id=$1",[object.id]);
      await assert.rejects(complete(db,id,[object.name]),/must be verified/);
      assert.equal((await saved(db,id)).rows.length,0);
      assert.equal((await db.query("select status from booking_requests where id=$1",[id])).rows[0].status,"accepted");
    });
    await t.test("legacy public-photo and credential policies do not expose completion images",async()=>{
      const legacy=(await as(db,provider,()=>db.query("insert into storage.objects(bucket_id,name,metadata) values('provider-photos',$1,'{}') returning id",[`${provider}/portfolio.png`]))).rows[0];
      assert.equal((await as(db,null,()=>db.query("select id from storage.objects where id=$1",[legacy.id]),"anon")).rows.length,1);
      const id=await booking(db);const object=await photo(db,id);await verify(db,id,object);await complete(db,id,[object.name]);
      for(const who of [otherProvider,otherCustomer]){
        assert.equal((await as(db,who,()=>db.query("select id from storage.objects where id=$1",[object.id]))).rows.length,0);
      }
      assert.equal((await as(db,null,()=>db.query("select id from storage.objects where id=$1",[object.id]),"anon")).rows.length,0);
      const mutableId=await booking(db);const mutable=await photo(db,mutableId);await verify(db,mutableId,mutable);
      await db.query("update storage.objects set updated_at=updated_at+interval '1 second' where id=$1",[mutable.id]);
      await assert.rejects(complete(db,mutableId,[mutable.name]),/must be verified/);
    });
    await t.test("rerunning migration preserves existing completion/photo records",async()=>{
      const before=(await db.query("select * from booking_completion_photos order by id")).rows;
      await db.exec(await migration("20261113000000_booking_completion_photos.sql"));
      await db.exec(await migration("20261113010000_completion_photo_snapshot.sql"));
      assert.deepEqual((await db.query("select * from booking_completion_photos order by id")).rows,before);
    });
  }finally{await db.close();}
});
