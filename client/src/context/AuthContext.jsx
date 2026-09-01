import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null); // { role, email, ... } desde nuestro backend
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true); // clave: mientras no tengamos el perfil (con el rol), nadie debe decidir a dónde redirigir
      setFirebaseUser(user);
      if (user) {
        try {
          // skipGlobalErrorToast: justo después de crear la cuenta en Firebase Auth
          // (ver Register.jsx), este listener se dispara ANTES de que el backend termine
          // de crear el perfil en Firestore (redeemInvitationCode + guardar el doc). Un 404
          // acá es un estado transitorio esperado, no un error real — mostrarlo como toast
          // solo asusta al usuario mientras el registro, de hecho, sí se está completando.
          const { data } = await api.get("/api/auth/profile", { skipGlobalErrorToast: true });
          setProfile(data);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, logout, refreshProfile: async () => {
      const { data } = await api.get("/api/auth/profile", { skipGlobalErrorToast: true });
      setProfile(data);
    } }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
