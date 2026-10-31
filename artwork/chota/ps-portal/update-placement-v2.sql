-- Upload and verify shop-media/chota/ps-portal-v2.png before applying.
-- Only migrate the known v1 visual; never overwrite a newer administration edit.
UPDATE public.chota_item_catalog
SET description = 'Una PS Portal blanca, tumbada sobre el asiento naranja de la sede.',
    presentation = '{"type":"decoration","path":"chota/ps-portal-v2.png","width":1020,"height":495,"animated":false,"placement":{"x":82.5,"y":60.3,"width":7.2,"rotation":0,"z":2},"motion":"none"}'::jsonb
WHERE id = 'chota-ps-portal'
  AND presentation->>'path' = 'chota/ps-portal-v1.png';
