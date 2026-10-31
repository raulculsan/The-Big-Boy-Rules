-- Upload ps-portal-v1.png to shop-media/chota/ps-portal-v1.png first.
-- Reviewed publication only; reruns preserve all existing prices and metadata.
INSERT INTO public.chota_item_catalog
  (id, name, description, art_key, price, active, sort_order, presentation)
VALUES
  ('chota-ps-portal', 'PS Portal', 'Una PS Portal blanca, descansando junto al sofá de la sede.', 'ps-portal', 35, true, 14,
   '{"type":"decoration","path":"chota/ps-portal-v1.png","width":720,"height":300,"animated":false,"placement":{"x":25.8,"y":59,"width":10,"rotation":0,"z":2},"motion":"none"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
