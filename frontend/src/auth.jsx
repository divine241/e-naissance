
import { createContext, useContext, useState } from "react";
import { Navigate } from "react-router-dom";
import { allMenuItems } from "./data/menu.js";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:14975/api";

export const ROLE_INFO = {
  admin: {
    label: "Administrateur",
    description: "Administration générale"
  },
  officier: {
    label: "Officier d'état civil",
    description: "Gestion et validation des actes"
  },
  agent: {
    label: "Agent d'état civil",
    description: "Enregistrement des déclarations"
  },
  hopital: {
    label: "Personnel hospitalier",
    description: "Déclaration des naissances"
  },
  consultation: {
    label: "Consultation",
    description: "Consultation et vérification des actes"
  }
};

// Vérifier si un utilisateur peut accéder à une page
export const canAccess = (path, role) => {
  const menuItem = allMenuItems.find(
    (item) => item.path === path
  );

  if (!menuItem || !role) return false;

  return menuItem.roles?.includes(role) ?? false;
};

// Vérifier si un utilisateur peut créer ou modifier
export const canWrite = (path, role) => {
  const menuItem = allMenuItems.find(
    (item) => item.path === path
  );

  if (!menuItem || !role) return false;

  return menuItem.write?.includes(role) ?? false;
};

// Contexte d'authentification
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth doit être utilisé dans AuthProvider."
    );
  }

  return context;
};

// Récupérer la session existante
function readSession() {
  try {
    const token = sessionStorage.getItem("token");

    const session = JSON.parse(
      sessionStorage.getItem("session") ?? "null"
    );

    return token && session ? session : null;
  } catch {
    return null;
  }
}

// Fournisseur d'authentification
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  // Connexion à l'API backend
  const login = async (identifiant, motDePasse) => {
    let response;

    try {
      response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identifiant,
          motDePasse
        })
      });
    } catch (error) {
      throw new Error(
        "Impossible de contacter le serveur. Vérifie que le backend e-Naissance fonctionne sur le port 8100."
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message ||
        "Identifiant ou mot de passe incorrect."
      );
    }

    if (!data.user || !data.token) {
      throw new Error(
        "La réponse du serveur est incomplète."
      );
    }

    const u = {
      ...data.user,
      initiales: (data.user.nom || "")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("")
    };

    // Enregistrer la session
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("session", JSON.stringify(u));

    setUser(u);

    return u;
  };

  // Déconnexion
  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("session");

    setUser(null);
  };

  // Modifier le centre affiché dans la session
  const setCentre = (centre) => {
    setUser((u) => {
      if (!u) return null;

      const next = {
        ...u,
        centre
      };

      sessionStorage.setItem(
        "session",
        JSON.stringify(next)
      );

      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        setCentre
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Protéger les pages nécessitant une connexion
export function RequireAuth({ children }) {
  const { user } = useAuth();

  return user ? (
    children
  ) : (
    <Navigate to="/connexion" replace />
  );
}
