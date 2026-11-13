import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMPLETION_PHOTO_BUCKET, MAX_COMPLETION_PHOTOS, MAX_COMPLETION_PHOTO_BYTES,
  completionPhotoPath, validCompletionPhotoPath, detectCompletionPhotoType, isCompletionPhotoType,
} from "../src/lib/marketplace/completion-photo-values.ts";

const provider="10000000-0000-4000-8000-000000000001";
const booking="10000000-0000-4000-8000-000000000002";
const file="10000000-0000-4000-8000-000000000003";

test("completion paths bind a supported photo to an exact provider and booking", () => {
  assert.equal(COMPLETION_PHOTO_BUCKET,"booking-completion-photos");
  assert.equal(MAX_COMPLETION_PHOTOS,5);
  assert.equal(MAX_COMPLETION_PHOTO_BYTES,5242880);
  for(const [type,extension] of [["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"]]){
    const path=completionPhotoPath(provider,booking,file,type);
    assert.equal(path,`${provider}/${booking}/${file}.${extension}`);
    assert.equal(validCompletionPhotoPath(path,provider,booking),true);
    assert.equal(validCompletionPhotoPath(path,file,booking),false);
    assert.equal(validCompletionPhotoPath(path,provider,file),false);
  }
  for(const path of ["../photo.png",`${provider}/${booking}/../../photo.png`,`${provider}/${booking}/image.png`,`${provider}/${booking}/${file}.svg`,null,42]){
    assert.equal(validCompletionPhotoPath(path,provider,booking),false);
  }
  assert.throws(()=>completionPhotoPath(provider,booking,file,"image/svg+xml"));
  assert.throws(()=>completionPhotoPath("not-a-uuid",booking,file,"image/png"));
});

test("image byte identification rejects active content and mislabeled files", () => {
  assert.equal(detectCompletionPhotoType(new Uint8Array([255,216,255,224])),"image/jpeg");
  const png=new Uint8Array(24);png.set([137,80,78,71,13,10,26,10]);png.set([73,72,68,82],12);
  assert.equal(detectCompletionPhotoType(png),"image/png");
  const webp=new TextEncoder().encode("RIFF0000WEBPVP8 0000");
  assert.equal(detectCompletionPhotoType(webp),"image/webp");
  for(const text of ["<svg xmlns='http://www.w3.org/2000/svg'></svg>","<!doctype html><script>alert(1)</script>","RIFF0000WAVEVP8 0000"]){
    assert.equal(detectCompletionPhotoType(new TextEncoder().encode(text)),null);
  }
  assert.equal(detectCompletionPhotoType(new Uint8Array()),null);
  assert.equal(isCompletionPhotoType("image/svg+xml"),false);
  assert.equal(isCompletionPhotoType("text/html"),false);
});
