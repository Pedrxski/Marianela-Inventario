-- ============================================================
-- Esquema de base de datos para la app de inventario
-- Ejecutar completo en Supabase: SQL Editor > New query > Run
-- ============================================================

-- Tabla de prendas (inventario)
create table if not exists garments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  price numeric(10,2) not null default 0,
  cost numeric(10,2) not null default 0,
  units integer not null default 0,
  sizes text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Tabla de ventas
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid references garments(id) on delete set null,
  garment_name text not null,
  type text not null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  unit_cost numeric(10,2) not null,
  sale_date date not null,
  created_at timestamptz not null default now()
);

-- Seguridad a nivel de fila (obligatoria en Supabase para leer/escribir desde el navegador)
alter table garments enable row level security;
alter table sales enable row level security;

-- Política simple: cualquiera con la clave pública "anon" puede leer y escribir.
-- Suficiente para una app personal que no vas a compartir públicamente.
-- Más adelante se puede restringir con autenticación (ver README.md, paso opcional).
create policy "Allow all - garments" on garments for all using (true) with check (true);
create policy "Allow all - sales" on sales for all using (true) with check (true);

-- Activa el tiempo real: si un dispositivo cambia algo, los demás se actualizan solos.
alter publication supabase_realtime add table garments, sales;
