import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import PrivateRoute from "./routes/PrivateRoute";
import RoleRoute from "./routes/RoleRoute";
import AppShell from "./components/common/AppShell";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RoleDashboard from "./pages/common/RoleDashboard";
import DeviceManager from "./pages/admin/DeviceManager";
import EventManager from "./pages/admin/EventManager";
import EventZones from "./pages/admin/EventZones";
import EventTeam from "./pages/admin/EventTeam";
import ClientManager from "./pages/admin/ClientManager";
import ZoneScheduleReview from "./pages/admin/ZoneScheduleReview";
import AdminSchedulesOverview from "./pages/admin/AdminSchedulesOverview";
import AdminAgenda from "./pages/admin/AdminAgenda";
import ProductorManager from "./pages/admin/ProductorManager";
import EventAuditLog from "./pages/admin/EventAuditLog";
import EventDeliveryDashboard from "./pages/admin/EventDeliveryDashboard";
import Notifications from "./pages/admin/Notifications";
import ZoneWorkspace from "./pages/user/ZoneWorkspace";
import ScheduleBuilder from "./pages/user/ScheduleBuilder";
import SubadminManager from "./pages/admin/SubadminManager";
import InvitationCodes from "./pages/admin/InvitationCodes";
import ArchivedEvents from "./pages/admin/ArchivedEvents";
import MyZones from "./pages/user/MyZones";

// Roles con acceso "de staff" amplio (ven eventos, zonas, biblioteca, notificaciones, códigos)
const STAFF_ROLES = ["admin", "subadmin", "productor"];

function AdminPage({ title, children }) {
  return (
    <PrivateRoute><RoleRoute allowed={["admin"]}>
      <AppShell title={title}>{children}</AppShell>
    </RoleRoute></PrivateRoute>
  );
}

function AdminOrSubadminPage({ title, children }) {
  return (
    <PrivateRoute><RoleRoute allowed={["admin", "subadmin"]}>
      <AppShell title={title}>{children}</AppShell>
    </RoleRoute></PrivateRoute>
  );
}

function StaffPage({ title, children }) {
  return (
    <PrivateRoute><RoleRoute allowed={STAFF_ROLES}>
      <AppShell title={title}>{children}</AppShell>
    </RoleRoute></PrivateRoute>
  );
}

export default function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />

          <Route path="/my-zones" element={
            <PrivateRoute><AppShell title="Mis zonas"><MyZones /></AppShell></PrivateRoute>
          } />
          <Route path="/zones/:eventId/:zoneId" element={
            <PrivateRoute><AppShell title="Zona"><ZoneWorkspace /></AppShell></PrivateRoute>
          } />
          <Route path="/catalog" element={
            <PrivateRoute><AppShell title="Biblioteca"><DeviceManager /></AppShell></PrivateRoute>
          } />
          <Route path="/zones/:eventId/:zoneId/schedule" element={
            <PrivateRoute><AppShell title="Cronograma"><ScheduleBuilder /></AppShell></PrivateRoute>
          } />

          {/* Panel de administrador */}
          <Route path="/admin" element={<AdminPage title="Panel de administrador"><RoleDashboard /></AdminPage>} />
          <Route path="/admin/subadmins" element={<AdminPage title="Sub-administradores"><SubadminManager /></AdminPage>} />
          <Route path="/admin/archived" element={<AdminPage title="Eventos archivados"><ArchivedEvents /></AdminPage>} />

          {/* Panel de sub-administrador */}
          <Route path="/subadmin" element={
            <PrivateRoute><RoleRoute allowed={["subadmin"]}>
              <AppShell title="Panel de sub-administrador"><RoleDashboard /></AppShell>
            </RoleRoute></PrivateRoute>
          } />

          {/* Panel de productor */}
          <Route path="/productor" element={
            <PrivateRoute><RoleRoute allowed={["productor"]}>
              <AppShell title="Panel de productor"><RoleDashboard /></AppShell>
            </RoleRoute></PrivateRoute>
          } />
          <Route path="/productor/clients" element={
            <PrivateRoute><RoleRoute allowed={["productor"]}>
              <AppShell title="Usuarios"><ClientManager /></AppShell>
            </RoleRoute></PrivateRoute>
          } />

          {/* Módulos compartidos por los 3 roles de staff */}
          <Route path="/admin/events" element={<StaffPage title="Eventos y planos"><EventManager /></StaffPage>} />
          <Route path="/admin/events/:id/zones" element={<StaffPage title="Zonas del evento"><EventZones /></StaffPage>} />
          <Route path="/admin/events/:id/team" element={<AdminOrSubadminPage title="Equipo del evento"><EventTeam /></AdminOrSubadminPage>} />
          <Route path="/admin/events/:id/audit-log" element={<AdminOrSubadminPage title="Historial de cambios"><EventAuditLog /></AdminOrSubadminPage>} />
          <Route path="/admin/events/:id/progress" element={<AdminPage title="Avance de entregas"><EventDeliveryDashboard /></AdminPage>} />
          <Route path="/admin/events/:eventId/zones/:zoneId/schedules" element={<StaffPage title="Cronograma de la zona"><ZoneScheduleReview /></StaffPage>} />
          <Route path="/admin/schedules" element={<StaffPage title="Cronogramas"><AdminSchedulesOverview /></StaffPage>} />
          <Route path="/admin/agenda" element={<AdminPage title="Agenda de entregas"><AdminAgenda /></AdminPage>} />
          <Route path="/admin/devices" element={<StaffPage title="Biblioteca"><DeviceManager /></StaffPage>} />
          <Route path="/admin/productores" element={<AdminOrSubadminPage title="Productores"><ProductorManager /></AdminOrSubadminPage>} />
          <Route path="/admin/invitations" element={<StaffPage title="Códigos de invitación"><InvitationCodes /></StaffPage>} />
          <Route path="/admin/notifications" element={<StaffPage title="Notificaciones"><Notifications /></StaffPage>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
  );
}
