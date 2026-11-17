# VC Estética Integral · Turnos online

Página de turnos y panel de agenda para **VC Estética Integral** (Victoria Cravero, Juana Azurduy 54, Sunchales).
Sistema independiente: base de datos propia (Supabase) y página propia (Vercel). HTML + JS sin compilar.

- `index.html` → la página pública: servicios, equipo, dónde estamos, reservar, "Mi turno" (cambiar/cancelar con código), lista de espera.
- `admin.html` → el panel de Victoria (pensado para el celular).

## Puesta en marcha (≈15 minutos)

### 1. Base de datos (Supabase)
1. Crear un proyecto **nuevo** en supabase.com (región São Paulo).
2. SQL Editor → pegar y correr `supabase/esquema.sql`.
3. SQL Editor → pegar y correr `supabase/datos-iniciales.sql` (una sola vez).
4. **Authentication → Sign In / Providers → desactivar "Allow new users to sign up".** ⚠️ Importante: cualquier usuario logueado puede ver y editar toda la agenda, así que la única cuenta tiene que ser la de Victoria.
5. Authentication → Users → **Add user** → mail y contraseña de Victoria (marcar "Auto confirm").
6. Project Settings → API → copiar **Project URL** y **anon public key**.

### 2. Configurar
Editar `js/config.js` con esos dos datos.

### 3. Publicar (Vercel)
1. Subir la carpeta a un repo nuevo de GitHub.
2. En Vercel: Add New → Project → importar el repo → Framework: **Other** → Deploy (no hay build).
3. Página: `https://<proyecto>.vercel.app` · Panel: `https://<proyecto>.vercel.app/admin.html`
4. En el celu de Victoria: abrir el panel → "Agregar a pantalla de inicio".

## Antes de entregar, confirmar con Victoria
- **WhatsApp:** el que está cargado (03493 15-449066) sale de una tarjeta vieja del Instagram. Se cambia en Panel → Ajustes.
- **Servicios, duraciones y precios:** cargados como borrador desde los destacados del Instagram. Revisar quién hace Botox y labios.
- **Horarios:** borrador L a V 8–12 y 15–20, sábados 8–12, para las tres. Se editan en Panel → Ajustes → Horario.
- **Fotos:** poner una foto del gabinete en `img/portada.jpg`. Si tiene el logo en archivo, reemplazar `img/monograma.svg`.

## Qué resuelve de lo que pidió
| Lo que le pasa | Cómo lo maneja |
|---|---|
| Sacan turno con un mes de anticipación | Ajustes → "Se puede reservar hasta X días adelante" |
| Le piden cambios a último momento | La clienta cambia sola desde su link hasta X horas antes; después tiene que escribirle |
| Mover a una del jueves al viernes | Agenda → tocar el turno → Mover (ve solo los libres, o pone un horario a mano) |
| Intercambiar dos clientas | Agenda → tocar el turno → Intercambiar con otro turno |
| Una clienta fija pide un lugar | Nuevo turno → horario a mano → "sobreturno" |
| Cancelaciones que dejan huecos | El hueco queda libre al toque y le muestra la lista de espera para ofrecérselo |
| Alivianar un día | Agenda → Bloquear horario |
| Que no se olviden | Recordar → un toque por clienta y sale el WhatsApp armado |

## Reglas que controla la base de datos
Las reservas, cambios y cancelaciones de la web pasan por funciones de Supabase (`reservar`, `reprogramar_turno`, `cancelar_turno`) que vuelven a chequear horario, bloqueos, superposición y plazos. El público no puede leer datos de las clientas.
Dos turnos confirmados de la misma profesional nunca se pisan (constraint `sin_superposicion`), salvo que Victoria lo cargue como sobreturno.
