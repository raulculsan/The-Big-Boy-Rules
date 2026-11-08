-- Match the renderer: atlas cell sizes are JSON numbers, never strings.
create or replace function public.valid_chota_clothing_manifest(value jsonb, expected_slot text, expected_rig text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare sheet text; asset_path text;
begin
 if value is null or expected_slot is null or expected_rig is null or jsonb_typeof(value)<>'object' or expected_slot not in ('outerwear','topwear','bottomwear','footwear','headwear','accessories') or expected_rig !~ '^[a-z0-9-]{1,60}$' then return false; end if;
 if value->>'type'='builtin' then
  return coalesce(expected_slot='outerwear' and expected_rig='chota-overlay-v1' and value->>'key' ~ '^tnf-(negro|crema|rojo|azul|oliva|morado)-v1$',false);
 end if;
 if coalesce(value->>'type','')<>'atlas' or coalesce(value->'cell','null'::jsonb) not in ('128'::jsonb,'256'::jsonb) or coalesce(jsonb_typeof(value->'atlases'),'')<>'object' then return false; end if;
 if exists(select 1 from jsonb_object_keys(value->'atlases') k where k not in ('base','directional','contextual','room','talk')) then return false; end if;
 foreach sheet in array array['base','directional','contextual','room','talk'] loop
  asset_path:=value->'atlases'->>sheet;
  if asset_path is null or asset_path !~ '^chota/wardrobe/[A-Za-z0-9/_-]{1,180}\.webp$' then return false; end if;
 end loop;
 return true;
end;
$$;
