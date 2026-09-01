import {
  LayoutDashboard, CalendarClock, CalendarRange, Boxes, Users, UserCog,
  Ticket, Archive, Bell, MapPin,
} from "lucide-react";

/**
 * Configuración única de navegación por rol. Antes había 3 lugares con la misma lista
 * repetida a mano (la barra lateral y cada uno de los 3 dashboards) — se fueron
 * desincronizando con el tiempo (por ejemplo, "Agenda" y "Cronogramas" faltaban en algunos
 * dashboards aunque sí estaban en el menú). Ahora todo sale de aquí, una sola vez.
 */
export const NAV_BY_ROLE = {
  admin: [
    { to: "/admin", label: "Panel", icon: LayoutDashboard, end: true },
    { to: "/admin/events", label: "Eventos", icon: CalendarRange, desc: "Crear eventos, subir el plano y dibujar zonas." },
    { to: "/admin/schedules", label: "Cronogramas", icon: CalendarClock, desc: "Ver todos los cronogramas enviados, de todos los eventos." },
    { to: "/admin/agenda", label: "Agenda", icon: CalendarClock, desc: "Todas las entregas, de todos los eventos, organizadas por fecha." },
    { to: "/admin/devices", label: "Biblioteca", icon: Boxes, desc: "Ver, agregar y editar los ítems disponibles." },
    { to: "/admin/subadmins", label: "Sub-admins", icon: UserCog, desc: "Crear y gestionar cuentas de sub-administradores." },
    { to: "/admin/productores", label: "Productores", icon: Users, desc: "Crear y gestionar cuentas de productores." },
    { to: "/admin/invitations", label: "Códigos", icon: Ticket, desc: "Generar códigos de un solo uso para usuarios." },
    { to: "/admin/archived", label: "Archivo", icon: Archive, desc: "Consultar distribuciones de eventos anteriores." },
    { to: "/admin/notifications", label: "Avisos", icon: Bell, showBadge: true, desc: "Cronogramas enviados y solicitudes por revisar." },
  ],
  subadmin: [
    { to: "/subadmin", label: "Panel", icon: LayoutDashboard, end: true },
    { to: "/admin/events", label: "Eventos", icon: CalendarRange, desc: "Ver tus eventos asignados, sus zonas y su equipo." },
    { to: "/admin/schedules", label: "Cronogramas", icon: CalendarClock, desc: "Ver los cronogramas enviados en tus eventos." },
    { to: "/admin/devices", label: "Biblioteca", icon: Boxes, desc: "Ver, agregar y editar los ítems disponibles." },
    { to: "/admin/productores", label: "Productores", icon: Users, desc: "Crear y gestionar cuentas de productores." },
    { to: "/admin/invitations", label: "Códigos", icon: Ticket, desc: "Generar códigos de un solo uso para usuarios." },
    { to: "/admin/notifications", label: "Avisos", icon: Bell, showBadge: true, desc: "Cronogramas enviados y solicitudes por revisar." },
  ],
  productor: [
    { to: "/productor", label: "Panel", icon: LayoutDashboard, end: true },
    { to: "/admin/events", label: "Eventos", icon: CalendarRange, desc: "Ver tus eventos asignados." },
    { to: "/admin/schedules", label: "Cronogramas", icon: CalendarClock, desc: "Ver y aprobar los cronogramas de tus usuarios." },
    { to: "/admin/devices", label: "Biblioteca", icon: Boxes, desc: "Ver, agregar y editar los ítems disponibles." },
    { to: "/productor/clients", label: "Usuarios", icon: Users, desc: "Buscar y consultar las zonas asignadas a cada usuario." },
    { to: "/admin/invitations", label: "Códigos", icon: Ticket, desc: "Generar códigos de un solo uso para usuarios." },
    { to: "/admin/notifications", label: "Avisos", icon: Bell, showBadge: true, desc: "Cronogramas enviados y solicitudes por revisar." },
  ],
  user: [
    { to: "/my-zones", label: "Mis zonas", icon: MapPin, end: true, desc: "Las zonas del plano que te asignaron." },
    { to: "/catalog", label: "Biblioteca", icon: Boxes, desc: "Consulta los ítems disponibles para tus zonas." },
  ],
};

export const ROLE_LABEL = {
  admin: "Administrador",
  subadmin: "Sub-administrador",
  productor: "Productor",
  user: "Usuario",
};
