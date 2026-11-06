-- Publish the provider-only policy versions after deploying their page source.
insert into public.legal_document_versions (
  document_key, document_version, title, document_path, content_sha256,
  audience, effective_at
)
values
  (
    'provider_agreement', '2026-11-05', 'Provider Agreement', '/provider-agreement',
    '61668b104bc610ef4f54ae1f5778f9a082c6f3d461ed3d2326a60f960b176de4',
    'provider', now()
  ),
  (
    'provider_standards', '2026-11-05', 'Provider Standards', '/provider-standards',
    '020184db324d5e3a5c53102812b95bc2c7738902f2b63de881b99c8ceb38eb12',
    'provider', now()
  )
on conflict (document_key, document_version) do nothing;
