/**
 * Contenido del menú de ayuda contextual (ícono "?" arriba a la derecha, ver HelpMenu.jsx).
 * Cada entrada tiene una `match(pathname)` que decide si aplica a la ruta actual, un
 * `title` (nombre de la vista) y varios `topics` cortos que funcionan como mini-tutorial de
 * lo que se puede hacer en esa pantalla.
 * Se evalúan en orden y se usa la PRIMERA que haga match — por eso las rutas más específicas
 * (con :id) van antes que las genéricas.
 */
const HELP_CONTENT = [
  {
    match: (p) => p === "/",
    title: "Inicio",
    topics: [
      { q: "¿Qué veo aquí?", a: "Un resumen rápido de tu cuenta y accesos directos a lo que más usas, según tu rol." },
      { q: "¿Dónde reviso notificaciones?", a: "En el ícono de campana del menú lateral — ahí llegan avisos de cronogramas enviados, aprobaciones y solicitudes." },
    ],
  },
  {
    match: (p) => p === "/my-zones",
    title: "Mis zonas",
    topics: [
      { q: "¿Qué es una zona?", a: "Un área del plano del evento donde te toca colocar y programar la entrega de electrodomésticos." },
      { q: "¿Cómo entro a trabajar en una?", a: "Haz clic en la zona para abrir el plano interactivo y empezar a colocar puntos." },
    ],
  },
  {
    match: (p) => /^\/zones\/[^/]+\/[^/]+\/schedule/.test(p),
    title: "Cronograma de zona",
    topics: [
      { q: "¿Cómo reparto las cantidades?", a: "En la tabla, escribe cuántas unidades de cada electrodoméstico entregas cada día. La suma no puede pasar del total que colocaste en el plano." },
      { q: "¿Borrador o enviar?", a: "'Guardar borrador' lo deja editable. 'Enviar' avisa a tu productor/administrador — desde ahí tienes 48 horas para seguir editándolo." },
      { q: "¿Por qué ya no puedo editar?", a: "Se bloquea automáticamente 2 días antes de que empiece la entrega, o 48 horas después de enviarlo, para evitar cambios de último momento. Si necesitas ajustar algo, contacta a tu productor o administrador." },
    ],
  },
  {
    match: (p) => /^\/zones\/[^/]+\/[^/]+/.test(p),
    title: "Plano de la zona",
    topics: [
      { q: "¿Cómo coloco un electrodoméstico?", a: "Haz clic en el plano donde va el punto, elige el electrodoméstico de la biblioteca y la cantidad." },
      { q: "¿Cómo veo mi cronograma?", a: "Usa el botón de 'Cronograma' para repartir esas cantidades día por día dentro del rango que definió el administrador." },
    ],
  },
  {
    match: (p) => p === "/catalog",
    title: "Biblioteca (catálogo)",
    topics: [
      { q: "¿Para qué es esta vista?", a: "Consultar qué electrodomésticos existen disponibles, con su categoría y referencia, para elegirlos al armar tu plano." },
      { q: "¿No encuentras algo?", a: "Usa el buscador de arriba, o pide que lo agreguen a la biblioteca desde el botón correspondiente." },
    ],
  },
  {
    match: (p) => p === "/admin" || p === "/subadmin" || p === "/productor",
    title: "Panel principal",
    topics: [
      { q: "¿Qué es este panel?", a: "Tu punto de partida: accesos directos a eventos, biblioteca, equipo y cronogramas según lo que puede hacer tu rol." },
      { q: "¿Cómo navego a otras secciones?", a: "Usa el menú lateral (o inferior en celular) — ahí están todas las secciones a las que tienes acceso." },
    ],
  },
  {
    match: (p) => p === "/admin/subadmins",
    title: "Sub-administradores",
    topics: [
      { q: "¿Cómo invito a un sub-admin?", a: "Genera un código de invitación desde 'Códigos de invitación' con el rol 'sub-admin', y compárteselo." },
      { q: "¿Puedo renombrar o eliminar uno?", a: "Sí, con los íconos de lápiz y basura al lado de cada fila. Eliminar borra su acceso por completo, no se puede deshacer." },
    ],
  },
  {
    match: (p) => p === "/admin/archived",
    title: "Eventos archivados",
    topics: [
      { q: "¿Qué pasa con un evento archivado?", a: "Deja de aparecer en la lista activa de eventos, pero conserva todo su historial, zonas y cronogramas para consultarlos después." },
    ],
  },
  {
    match: (p) => p === "/productor/clients",
    title: "Clientes",
    topics: [
      { q: "¿Qué es un cliente aquí?", a: "Los usuarios finales que invitaste con tu código y que colocan/programan sus propios electrodomésticos en las zonas del evento." },
      { q: "¿Cómo invito a uno?", a: "Comparte tu código de invitación de productor — al registrarse quedará vinculado a ti automáticamente." },
    ],
  },
  {
    match: (p) => p === "/admin/events",
    title: "Eventos y planos",
    topics: [
      { q: "¿Cómo creo un evento?", a: "Botón '+ Nuevo evento': sube el plano del recinto, define fecha de inicio y duración del cronograma." },
      { q: "¿Cómo entro a las zonas de un evento?", a: "Haz clic en cualquier parte de la tarjeta del evento (o en su nombre) para ir directo a sus zonas." },
      { q: "¿Para qué son los botones de la tarjeta?", a: "Zonas, Equipo, Historial, Fechas y Avance — accesos rápidos sin tener que entrar primero a Zonas." },
    ],
  },
  {
    match: (p) => /^\/admin\/events\/[^/]+\/zones$/.test(p),
    title: "Zonas del evento",
    topics: [
      { q: "¿Qué es una zona?", a: "Una subdivisión del plano (ej. 'Tribuna Norte') donde se colocan y programan electrodomésticos por separado." },
      { q: "¿Cómo creo una zona nueva?", a: "Dibuja el área directamente sobre el plano y ponle un nombre y color distintivo." },
    ],
  },
  {
    match: (p) => /^\/admin\/events\/[^/]+\/team$/.test(p),
    title: "Equipo del evento",
    topics: [
      { q: "¿Qué hago aquí?", a: "Asignar qué sub-administradores y productores pueden ver y trabajar en este evento específico." },
      { q: "¿Por qué no veo el evento en otro rol?", a: "Solo lo ven los sub-admins/productores que asignes aquí — así cada quien ve únicamente lo que le corresponde." },
    ],
  },
  {
    match: (p) => /^\/admin\/events\/[^/]+\/audit-log$/.test(p),
    title: "Historial de cambios",
    topics: [
      { q: "¿Qué se registra aquí?", a: "Cada acción importante sobre este evento: creación de zonas, cambios de fechas, envíos de cronograma, aprobaciones, etc., con quién y cuándo la hizo." },
    ],
  },
  {
    match: (p) => /^\/admin\/events\/[^/]+\/progress$/.test(p),
    title: "Avance de entregas",
    topics: [
      { q: "¿Qué muestra el porcentaje?", a: "Cuánto de lo programado ya se marcó como entregado, por zona y en total para el evento." },
      { q: "¿Por qué una zona no aparece?", a: "Las zonas sin electrodomésticos colocados no tienen nada que entregar todavía, así que no suman al cálculo." },
    ],
  },
  {
    match: (p) => /^\/admin\/events\/[^/]+\/zones\/[^/]+\/schedules$/.test(p),
    title: "Cronograma de la zona (revisión)",
    topics: [
      { q: "¿Qué hago aquí?", a: "Revisar el cronograma que un usuario envió: aprobarlo, o pedir correcciones con un comentario que él podrá ver." },
      { q: "¿Cómo funciona la cadena de aprobación?", a: "Usuario → productor → sub-admin → admin. Cada eslabón aprueba en orden; si alguien pide cambios, vuelve a manos del usuario." },
    ],
  },
  {
    match: (p) => p === "/admin/schedules",
    title: "Cronogramas",
    topics: [
      { q: "¿Qué veo en esta vista?", a: "Todos los cronogramas enviados, agrupados por evento y zona, con su estado de aprobación." },
      { q: "¿Cómo entro a revisar uno?", a: "Haz clic en la fila correspondiente para ver el detalle día por día y aprobarlo o pedir cambios." },
    ],
  },
  {
    match: (p) => p === "/admin/agenda",
    title: "Agenda de entregas",
    topics: [
      { q: "¿Qué organiza esta vista?", a: "Todas las entregas programadas de todos los eventos activos, ordenadas por fecha — para no perder de vista qué se entrega hoy y qué sigue." },
    ],
  },
  {
    match: (p) => p === "/admin/devices",
    title: "Biblioteca",
    topics: [
      { q: "¿Cómo agrego un ítem?", a: "Botón '+ Nuevo ítem': elige categoría, nombre, referencia y una foto opcional (se sube en la mejor calidad posible)." },
      { q: "¿Cómo administro categorías?", a: "Botón 'Categorías': crear, renombrar o eliminar. El nombre se escribe en mayúsculas para evitar duplicados como 'Sonido' y 'SONIDO' a la vez." },
      { q: "¿Y las solicitudes de usuarios?", a: "Botón 'Solicitudes': pedidos de electrodomésticos que no están en la biblioteca, enviados por productores/usuarios para que los agregues." },
    ],
  },
  {
    match: (p) => p === "/admin/productores",
    title: "Productores",
    topics: [
      { q: "¿Cómo invito a un productor?", a: "Genera un código de invitación con rol 'productor' desde 'Códigos de invitación'." },
      { q: "¿Qué puede hacer un productor?", a: "Invitar a sus propios clientes/usuarios y darles seguimiento dentro de los eventos que le asignes." },
    ],
  },
  {
    match: (p) => p === "/admin/invitations",
    title: "Códigos de invitación",
    topics: [
      { q: "¿Cómo genero uno?", a: "Elige el rol (sub-admin, productor o usuario) y crea el código; luego compártelo con la persona." },
      { q: "¿Los códigos expiran o se reusan?", a: "Cada código es de un solo uso; una vez registrado alguien con él, ya no sirve para otra persona." },
    ],
  },
  {
    match: (p) => p === "/admin/notifications",
    title: "Notificaciones",
    topics: [
      { q: "¿Qué avisa esta vista?", a: "Cronogramas enviados, aprobaciones, solicitudes de biblioteca y otros eventos importantes que te involucran." },
      { q: "¿Cómo las marco como leídas?", a: "Se marcan solas al abrirlas, o puedes marcarlas todas de una vez con el botón correspondiente." },
    ],
  },
];

const DEFAULT_HELP = {
  title: "Ayuda",
  topics: [
    { q: "¿Cómo navego la plataforma?", a: "Usa el menú lateral (o inferior en celular) para moverte entre las secciones disponibles para tu rol." },
  ],
};

/** Devuelve el contenido de ayuda que corresponde a la ruta actual (o uno genérico si no hay match). */
export function getHelpContent(pathname) {
  const entry = HELP_CONTENT.find((e) => e.match(pathname));
  return entry || DEFAULT_HELP;
}
