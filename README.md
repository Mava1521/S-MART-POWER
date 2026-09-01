# Sistema de Distribución de Electrodomésticos en Eventos

Aplicación con 3 roles (administrador, sub-administrador, usuario) para planificar la
distribución de dispositivos eléctricos por zonas en eventos (conciertos, etc.).

100% dentro del plan **gratuito**: Firebase Spark (Auth + Firestore, sin tarjeta) +
Cloudinary free tier (imágenes, sin tarjeta).

## Estado del proyecto

Esto es una base funcional, no la app completa — construimos lo suficiente para que
tengas arquitectura limpia y segura desde el día 1, y sigamos añadiendo el resto por partes.

**✅ Implementado y funcional:**
- Autenticación con Firebase Auth + roles vía custom claims
- Middleware de autenticación/autorización en el backend
- Registro de sub-administradores (solo admin) y de usuarios vía código de invitación
- Códigos de invitación de un solo uso, con transacción atómica anti-condición-de-carrera
- CRUD completo de electrodomésticos con imagen en Cloudinary (no en la BD), búsqueda,
  y notificación automática cuando un usuario agrega uno nuevo
- Creación de eventos con plano (imagen) y archivado
- Zonas con coordenadas + asignación a **varios usuarios por zona** + consulta "mis zonas"
- Reglas de seguridad de Firestore
- Frontend: login/registro, rutas protegidas por sesión y por rol, panel de admin con
  gestión de electrodomésticos funcionando de punta a punta

**🚧 Pendiente (estructura y páginas ya están, falta la lógica):**
- Editor visual del plano para dibujar zonas (canvas/SVG con zoom)
- Vista de usuario para colocar puntos de colores sobre su zona asignada
- Constructor de cronograma (días, cantidades, % de avance)
- Envío de cronograma + distribución a admin/sub-admin
- Centro de notificaciones en el frontend (el backend ya las genera)
- Panel de sub-administrador completo (código de invitación, reasignación de zonas)

## Requisitos previos

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com), plan **Spark**
2. Activar **Authentication** (método Email/Password)
3. Activar **Firestore Database** (modo producción)
4. Crear cuenta gratuita en [Cloudinary](https://cloudinary.com) (no pide tarjeta)
5. Node.js 18+

## Instalación

### Backend
```bash
cd server
cp .env.example .env   # completar con tus credenciales
npm install
node scripts/seedAdmin.js admin@correo.com contraseñaSegura123   # crea el primer admin
npm run dev
```

Para `.env`, las credenciales de Firebase Admin salen de:
Project Settings → Service Accounts → Generate new private key.

### Frontend
```bash
cd client
cp .env.example .env   # completar con tu config de Firebase (Project Settings > General)
npm install
npm run dev
```

### Reglas de Firestore
```bash
npm install -g firebase-tools
firebase login
cd firebase
firebase deploy --only firestore:rules
```

## Por qué esta arquitectura

- **Todo el rol/permiso se valida en el backend**, nunca solo en React — el frontend
  oculta botones por comodidad, pero cada endpoint vuelve a verificar rol y dueño del recurso.
- **Sin Firebase Storage**: desde feb-2026 requiere plan Blaze (tarjeta) aunque el uso
  sea gratis. Cloudinary evita eso y cumple igual "la foto no va en la base de datos".
- **Firestore Admin SDK en el backend** ignora `firestore.rules`, así que la seguridad real
  vive en `middlewares/roleMiddleware.js` y en cada controller — las reglas son una segunda
  capa de defensa por si en el futuro se agregan listeners directos desde el cliente.
- **Subcolección `zoneAssignments`** en vez de un campo único: permite N usuarios por zona
  y consultas rápidas de "mis zonas" sin recorrer todo el evento.
