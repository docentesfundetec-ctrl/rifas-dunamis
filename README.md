# Rifas Dunamis

Sitio público en GitHub Pages con HTML, Tailwind CSS, JavaScript, Firebase Authentication y Cloud Firestore.

Sitio: https://docentesfundetec-ctrl.github.io/rifas-dunamis/
Proyecto Firebase: rifas-dunamis.
Administrador: docentesfundetec@gmail.com mediante Google verificado.

## Uso

1. Ingresar en Mi equipo con Google para configurar la rifa inicial. Precio y cantidad quedan fijos para preservar los registros.
2. En Vendedores, registrar nombre, correo y contraseña inicial (cédula asignada por administrador, mínimo 6 caracteres). La contraseña se guarda únicamente en Firebase Authentication, nunca en Firestore, GitHub ni el enlace.
3. Entregar al vendedor su enlace individual con ?v=UID#tablero. El vendedor ingresa con correo y contraseña y comparte ese enlace.
4. El comprador elige un número, escribe nombre y celular y autoriza su tratamiento. La reserva se guarda atómicamente y se muestra ocupada para todos.
5. El vendedor o administrador confirma el pago. Solo números pagados participan. No hay pasarela ni procesamiento de pagos en línea.
6. En la fecha programada, el administrador ejecuta el sorteo. El modo automático requiere una sesión administrativa abierta; GitHub Pages no ejecuta tareas en segundo plano.

El público ve los números y sus estados. Los nombres completos, celulares y correos permanecen privados. El administrador puede desactivar vendedores y enlaces. Una cuenta Auth creada fuera del panel no obtiene el rol de vendedor.

## Seguridad y datos

- raffles/current: configuración pública, fecha, fase y resultado.
- tickets/{numero}: estado público, sin datos de contacto.
- sales/{numero}: comprador y celular privados; solo administrador, vendedor activo asignado y comprador propietario.
- sellers/{uid}: perfil privado registrado por el administrador.
- sellerLinks/{uid}: nombre público y estado del enlace.

Las reglas requieren escrituras atómicas de número y participación y validan la fecha con request.time del servidor. La fase drawing bloquea cambios antes de consultar los números pagados. Web Crypto elige uniformemente el ganador desde el navegador del administrador. El resultado se guarda una sola vez mediante transacción. Si se interrumpe, el administrador puede completar el sorteo pendiente. No es un sorteo certificado ni verificable externamente.

La prevención automatizada de abuso es un límite de esta integración: no se ha configurado CAPTCHA/App Check ni cuotas propias por comprador. El proyecto usa Spark y se aplican las cuotas de Firebase.

## Desarrollo

Requiere Node.js. Ejecutar npm ci, npm run build y npm run dev. Abrir http://localhost:4173.

src/ contiene el código fuente; styles.css define Tailwind. La compilación genera dist/ y docs/. GitHub Pages publica docs/ desde main. Tras editar el código hay que compilar y subir también docs/.

src/firebase-config.js contiene configuración pública de la app, no claves privadas. La autorización está en firestore.rules. Publicar las reglas por separado en Firebase Console o mediante firebase deploy --only firestore:rules --project rifas-dunamis desde una CLI autorizada.

npm test verifica las reglas de negocio. npm run test:rules ejecuta el emulador de Firestore y requiere Java 21 o posterior. Usa demo-rifas, sin tocar compradores reales. Cubre privacidad, roles, reservas simultáneas, consistencia atómica, cierre y resultado único.

Fuentes: [Transacciones](https://firebase.google.com/docs/firestore/manage-data/transactions), [Reglas](https://firebase.google.com/docs/firestore/security/get-started), [Google Sign-In](https://firebase.google.com/docs/auth/web/google-signin).
