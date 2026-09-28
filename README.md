# Inventario de la tienda

App de inventario y ventas conectada a Supabase, para usar desde cualquier
dispositivo (pensada para el iPhone, pero funciona en cualquier navegador).

---

## Paso 1 — Crear el proyecto en Supabase

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. **New Project** → ponle nombre, una contraseña de base de datos (guárdala)
   y la región más cercana a donde uses la app.
3. Cuando el proyecto esté listo, ve a **SQL Editor → New query**, pega el
   contenido completo del archivo [`supabase/schema.sql`](./supabase/schema.sql)
   de esta carpeta, y dale **Run**. Esto crea las tablas `garments` y `sales`,
   las políticas de seguridad y activa el tiempo real.
4. Ve a **Project Settings → API**. Vas a necesitar dos datos de ahí:
   - **Project URL**
   - **anon / public key**

   (No uses nunca la `service_role key` en el frontend — esa es secreta.)

---

## Paso 2 — Instalar Node.js (si no lo tienes)

Descárgalo de [nodejs.org](https://nodejs.org) (versión LTS) e instálalo.
Para comprobar que quedó instalado, abre una terminal y escribe:

```bash
node -v
npm -v
```

---

## Paso 3 — Instalar y correr la app en tu computadora

Desde la terminal, dentro de esta carpeta:

```bash
npm install
cp .env.example .env
```

Abre el archivo `.env` que se acaba de crear y reemplaza los valores con los
tuyos de Supabase (Paso 1.4):

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

Luego arranca la app:

```bash
npm run dev
```

Abre la URL que te muestra la terminal (normalmente `http://localhost:5173`)
y prueba añadir una prenda. Si aparece en Supabase (**Table Editor → garments**),
¡todo está conectado correctamente!

---

## Paso 4 — Subir el código a GitHub

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Crea un repositorio nuevo (puede ser privado).
3. Desde esta carpeta:

```bash
git init
git add .
git commit -m "Inventario de la tienda"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

(El archivo `.gitignore` ya está configurado para que tu `.env` con las
claves NO se suba a GitHub.)

---

## Paso 5 — Publicar con Vercel

1. Entra en [vercel.com](https://vercel.com) y crea una cuenta (puedes usar tu
   cuenta de GitHub para entrar directo).
2. **Add New → Project** → elige el repositorio que acabas de subir.
3. Antes de darle a *Deploy*, abre **Environment Variables** y agrega las
   mismas dos variables de tu `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Dale a **Deploy**. En 1-2 minutos tendrás una URL pública tipo
   `https://inventario-tienda.vercel.app`.

Cada vez que subas cambios a GitHub (`git push`), Vercel vuelve a publicar
la app automáticamente.

---

## Paso 6 — Usarla desde el iPhone

1. Abre la URL de Vercel en Safari (en el iPhone, tiene que ser Safari, no
   Chrome, para este paso).
2. Toca el ícono de compartir (el cuadrado con la flecha hacia arriba).
3. **Añadir a pantalla de inicio**.

Va a quedar como un ícono más en tu pantalla, y al abrirla no se ve la barra
de Safari — se siente como una app normal.

---

## Notas importantes sobre seguridad

- La app usa la clave **anon** de Supabase, que está pensada para ir en el
  código del navegador — no es secreta en el mismo sentido que una contraseña.
- Lo que sí protege tus datos son las **políticas de seguridad (RLS)** que
  creamos en `schema.sql`. Ahora mismo son "permitir todo", así que
  **cualquiera que tenga el link de tu app podría leer o modificar el
  inventario**. Para un uso personal/privado (no vas a compartir el link
  públicamente) esto es razonable para empezar.
- Si más adelante quieres compartir el link más ampliamente o dar acceso a
  empleados de forma controlada, se puede añadir un login simple con
  Supabase Auth y restringir las políticas a usuarios autenticados —
  pídele a Claude que te guíe en ese paso cuando lo necesites.

## Sincronización entre dispositivos

La app usa **Supabase Realtime**: si registras una venta desde el teléfono,
cualquier otra pantalla que tenga la app abierta (otro teléfono, una
computadora en el mostrador, etc.) se actualiza sola, sin recargar la página.
