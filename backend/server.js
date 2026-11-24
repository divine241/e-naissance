
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 7000;
// ==========================================
// 1. CONFIGURATION
// ==========================================

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET doit contenir au moins 32 caractÃ¨res.");
}

app.disable("x-powered-by");
app.use(helmet());

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5175",
    "http://localhost:5175",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "http://127.0.0.1:8081",
    "http://localhost:8081",
    "http://127.0.0.1:8831",
    "http://localhost:8831"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));
// 2. CONNEXION POSTGRESQL
// ==========================================

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on("error", (error) => {
  console.error("Erreur PostgreSQL :", error.message);
});

// ==========================================
// 3. AUTHENTIFICATION
// ==========================================

async function authenticateToken(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentification nÃ©cessaire."
      });
    }

    const token = authorization.substring(7);

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "e-naissance"
    });

    if (!decoded.sub) {
      return res.status(401).json({
        message: "Jeton invalide."
      });
    }

    const result = await pool.query(
      `SELECT
        u.id,
        u.identifiant,
        u.nom_complet,
        u.actif,
        r.code AS role,
        r.libelle AS role_label,
        c.nom AS centre,
        u.centre_id
      FROM utilisateurs u
      INNER JOIN roles r ON u.role_id = r.id
      LEFT JOIN centres c ON c.id = u.centre_id
      WHERE u.id = $1
      LIMIT 1`,
      [decoded.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Utilisateur introuvable."
      });
    }

    const user = result.rows[0];

    if (!user.actif) {
      return res.status(403).json({
        message: "Ce compte est dÃ©sactivÃ©."
      });
    }

    req.user = {
      id: user.id,
      identifiant: user.identifiant,
      nom: user.nom_complet,
      role: user.role,
      roleLabel: user.role_label,
      centre: user.centre,
      centreId: user.centre_id
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Jeton invalide ou expirÃ©. Reconnectez-vous."
      });
    }

    console.error("Erreur authentification :", error.message);

    return res.status(500).json({
      message: "Erreur pendant la vÃ©rification de l'utilisateur."
    });
  }
}

// ==========================================
// 4. AUTORISATIONS
// ==========================================

function authorizeRoles(...rolesAutorises) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentification nÃ©cessaire."
      });
    }

    if (!rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({
        message: "AccÃ¨s refusÃ©."
      });
    }

    next();
  };
}

// ==========================================
// 5. ROUTE D'ACCUEIL
// ==========================================

app.get("/", (req, res) => {
  res.json({
    message: "Bienvenue sur l'API e-Naissance",
    success: true
  });
});

// ==========================================
// 6. TEST POSTGRESQL
// ==========================================

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, current_user AS user"
    );

    res.json({
      success: true,
      message: "Connexion PostgreSQL rÃ©ussie.",
      database: result.rows[0].database,
      user: result.rows[0].user
    });
  } catch (error) {
    console.error("Erreur PostgreSQL :", error.message);

    res.status(500).json({
      message: "Impossible de contacter la base de donnÃ©es."
    });
  }
});

// ==========================================
// 7. CONNEXION UTILISATEUR
// ==========================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifiant, motDePasse } = req.body;

    if (
      typeof identifiant !== "string" ||
      typeof motDePasse !== "string" ||
      !identifiant.trim() ||
      !motDePasse
    ) {
      return res.status(400).json({
        message: "Veuillez renseigner votre identifiant et votre mot de passe."
      });
    }

    const result = await pool.query(
      `SELECT
        u.id,
        u.identifiant,
        u.nom_complet,
        u.mot_de_passe,
        u.actif,
        r.code AS role,
        r.libelle AS role_label,
        c.nom AS centre,
        u.centre_id
      FROM utilisateurs u
      INNER JOIN roles r ON u.role_id = r.id
      LEFT JOIN centres c ON u.centre_id = c.id
      WHERE u.identifiant = $1
      LIMIT 1`,
      [identifiant.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Identifiant ou mot de passe incorrect."
      });
    }

    const user = result.rows[0];

    if (!user.actif) {
      return res.status(403).json({
        message: "Ce compte est dÃ©sactivÃ©. Contactez l'administrateur."
      });
    }

    const validPassword = await bcrypt.compare(
      motDePasse,
      user.mot_de_passe
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Identifiant ou mot de passe incorrect."
      });
    }

    const token = jwt.sign(
      {
        sub: String(user.id),
        identifiant: user.identifiant
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
        issuer: "e-naissance"
      }
    );

    res.json({
      success: true,
      message: "Connexion rÃ©ussie.",
      token,
      user: {
        id: user.id,
        identifiant: user.identifiant,
        nom: user.nom_complet,
        role: user.role,
        roleLabel: user.role_label,
        centre: user.centre,
        centreId: user.centre_id
      }
    });
  } catch (error) {
    console.error("Erreur connexion :", error.message);

    res.status(500).json({
      message: "Une erreur est survenue pendant la connexion."
    });
  }
});

// ==========================================
// 8. UTILISATEUR CONNECTÃ‰
// ==========================================

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ==========================================
// 9. TEST ADMINISTRATEUR
// ==========================================

app.get(
  "/api/admin/test",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      success: true,
      message: "AccÃ¨s administrateur autorisÃ©.",
      user: req.user
    });
  }
);

// ==========================================
// 10. TABLEAU DE BORD GÃ‰NÃ‰RAL DYNAMIQUE
// ==========================================

app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const { role, centreId } = req.user;

    let condition = "";
    const values = [];

    if (role !== "admin") {
      if (!centreId) {
        return res.status(403).json({
          message: "Aucun centre associÃ© Ã  ce compte."
        });
      }

      condition = role === "hopital"
        ? "WHERE d.etablissement_id = $1"
        : "WHERE d.centre_id = $1";

      values.push(centreId);
    }

    const stats = await pool.query(`
      SELECT
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (
          WHERE COALESCE(
            d.date_declaration::date,
            d.date_creation::date
          ) = CURRENT_DATE
        )::INTEGER AS aujourd_hui,
        COUNT(*) FILTER (
          WHERE d.statut ILIKE '%ATTENTE%'
             OR d.statut ILIKE '%VERIFICATION%'
             OR d.statut ILIKE '%DEPOSE%'
        )::INTEGER AS en_attente,
        COUNT(*) FILTER (
          WHERE d.statut ILIKE '%VALID%'
             OR d.statut ILIKE '%ACTE_ETABLI%'
             OR d.statut ILIKE '%SIGNE%'
        )::INTEGER AS valides,
        COUNT(*) FILTER (
          WHERE d.statut ILIKE '%INCOMPLET%'
        )::INTEGER AS incomplets,
        COUNT(*) FILTER (
          WHERE d.hors_delai = TRUE
        )::INTEGER AS hors_delai
      FROM declarations d
      ${condition}
    `, values);

    const mois = await pool.query(`
      SELECT
        EXTRACT(MONTH FROM d.date_naissance)::INTEGER AS mois,
        COUNT(*)::INTEGER AS total
      FROM declarations d
      ${condition ? condition + " AND" : "WHERE"}
        EXTRACT(YEAR FROM d.date_naissance) =
        EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY mois
      ORDER BY mois
    `, values);

    const sexes = await pool.query(`
      SELECT
        sexe,
        COUNT(*)::INTEGER AS total
      FROM declarations d
      ${condition}
      GROUP BY sexe
    `, values);

    const statuts = await pool.query(`
      SELECT
        statut,
        COUNT(*)::INTEGER AS total
      FROM declarations d
      ${condition}
      GROUP BY statut
      ORDER BY total DESC
    `, values);

    const recentes = await pool.query(`
      SELECT
        d.id,
        d.reference,
        d.nom_enfant,
        d.prenoms_enfant,
        d.sexe,
        d.date_naissance,
        d.date_declaration,
        d.statut,
        d.hors_delai
      FROM declarations d
      ${condition}
      ORDER BY d.date_creation DESC NULLS LAST
      LIMIT 8
    `, values);

    let activite = { rows: [] };

    if (role !== "hopital") {
      const conditionAudit = role === "admin"
        ? ""
        : "WHERE centre_id = $1";

      activite = await pool.query(`
        SELECT
          id,
          action,
          entite,
          entite_id,
          details,
          date_action
        FROM journal_audit
        ${conditionAudit}
        ORDER BY date_action DESC
        LIMIT 6
      `, values);
    }

    res.json({
      success: true,
      role,
      statistiques: stats.rows[0],
      naissancesParMois: mois.rows,
      repartitionSexe: sexes.rows,
      statuts: statuts.rows,
      dossiersRecents: recentes.rows,
      activiteRecente: activite.rows
    });

  } catch (error) {
    console.error("Erreur tableau de bord :", error.message);

    res.status(500).json({
      message: "Erreur lors du chargement du tableau de bord."
    });
  }
});

// ==========================================
// 11. TABLEAU DE BORD ADMINISTRATEUR
// ==========================================

app.get(
  "/api/admin/dashboard",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const [
        utilisateurs,
        centres,
        operations,
        naissances,
        journal,
        utilisateursListe
      ] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER (WHERE actif = TRUE)::INTEGER AS actifs
          FROM utilisateurs
        `),

        pool.query(`
          SELECT
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER (WHERE actif = TRUE)::INTEGER AS actifs
          FROM centres
        `),

        pool.query(`
          SELECT COUNT(*)::INTEGER AS total
          FROM journal_audit
          WHERE date_action >= CURRENT_DATE
            AND date_action < CURRENT_DATE + INTERVAL '1 day'
        `),

        pool.query(`
          SELECT
            c.id,
            c.nom AS centre,
            COUNT(d.id)::INTEGER AS total
          FROM centres c
          LEFT JOIN declarations d ON d.centre_id = c.id
          GROUP BY c.id, c.nom
          ORDER BY c.nom
        `),

        pool.query(`
          SELECT
            j.id,
            j.action,
            j.entite,
            j.entite_id,
            j.details,
            j.date_action,
            COALESCE(u.nom_complet, 'Utilisateur inconnu') AS utilisateur,
            COALESCE(c.nom, 'Centre non renseignÃ©') AS centre
          FROM journal_audit j
          LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id
          LEFT JOIN centres c ON c.id = j.centre_id
          ORDER BY j.date_action DESC
          LIMIT 5
        `),

        pool.query(`
          SELECT
            u.id,
            u.identifiant,
            u.nom_complet,
            u.email,
            u.actif,
            r.libelle AS role,
            c.nom AS centre,
            u.date_creation
          FROM utilisateurs u
          LEFT JOIN roles r ON r.id = u.role_id
          LEFT JOIN centres c ON c.id = u.centre_id
          ORDER BY u.date_creation DESC, u.id DESC
          LIMIT 10
        `)
      ]);

      res.json({
        success: true,
        statistiques: {
          utilisateurs_total: utilisateurs.rows[0].total,
          utilisateurs_actifs: utilisateurs.rows[0].actifs,
          centres_total: centres.rows[0].total,
          centres_actifs: centres.rows[0].actifs,
          operations_aujourdhui: operations.rows[0].total
        },
        naissances_par_centre: naissances.rows,
        journal_recent: journal.rows,
        utilisateurs_recents: utilisateursListe.rows
      });
    } catch (error) {
      console.error("Erreur dashboard admin :", error.message);

      res.status(500).json({
        message: "Impossible de charger le tableau de bord administrateur."
      });
    }
  }
);


// ==========================================
// 12. GESTION DES UTILISATEURS
// ==========================================

// Liste complÃ¨te des utilisateurs
app.get(
  "/api/admin/utilisateurs",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          u.id,
          u.identifiant,
          u.nom_complet,
          u.email,
          u.actif,
          r.code AS role_code,
          r.libelle AS role,
          c.nom AS centre,
          u.centre_id,
          u.date_creation
        FROM utilisateurs u
        LEFT JOIN roles r ON r.id = u.role_id
        LEFT JOIN centres c ON c.id = u.centre_id
        ORDER BY u.date_creation DESC NULLS LAST, u.id DESC
      `);

      return res.json({
        success: true,
        utilisateurs: result.rows
      });
    } catch (error) {
      console.error("Erreur liste utilisateurs :", error.message);

      return res.status(500).json({
        success: false,
        message: "Impossible de charger les utilisateurs."
      });
    }
  }
);

// ------------------------------------------
// CRÃ‰ATION D'UN UTILISATEUR
// ------------------------------------------

app.post(
  "/api/admin/utilisateurs",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const identifiant = String(req.body.identifiant || "").trim();
    const nomComplet = String(
      req.body.nom_complet || req.body.nom || ""
    ).trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const motDePasse =
      req.body.motDePasse ||
      req.body.mot_de_passe ||
      req.body.password;

    const roleCode = String(
      req.body.role_code || req.body.role || ""
    ).trim().toLowerCase();

    const centreValue =
      req.body.centre_id !== undefined
        ? req.body.centre_id
        : req.body.centreId;

    const centreId =
      centreValue === "" || centreValue === null || centreValue === undefined
        ? null
        : Number(centreValue);

    if (!identifiant || !nomComplet || !motDePasse || !roleCode) {
      return res.status(400).json({
        success: false,
        message: "L'identifiant, le nom, le mot de passe et le rÃ´le sont obligatoires."
      });
    }

    if (identifiant.length > 100 || nomComplet.length > 200) {
      return res.status(400).json({
        success: false,
        message: "L'identifiant ou le nom est trop long."
      });
    }

    if (typeof motDePasse !== "string" || motDePasse.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Le mot de passe doit contenir au moins 8 caractÃ¨res."
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "L'adresse e-mail est invalide."
      });
    }

    if (!["admin", "officier", "agent", "hopital", "consultation"].includes(roleCode)) {
      return res.status(400).json({
        success: false,
        message: "Le rÃ´le sÃ©lectionnÃ© est invalide."
      });
    }

    if (
      centreId !== null &&
      (!Number.isInteger(centreId) || centreId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Le centre sÃ©lectionnÃ© est invalide."
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const doublon = await client.query(
        `SELECT id
         FROM utilisateurs
         WHERE LOWER(identifiant) = LOWER($1)
            OR ($2 <> '' AND LOWER(email) = LOWER($2))
         LIMIT 1`,
        [identifiant, email]
      );

      if (doublon.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "Cet identifiant ou cette adresse e-mail est dÃ©jÃ  utilisÃ©."
        });
      }

      const roleResult = await client.query(
        `SELECT id, code, libelle
         FROM roles
         WHERE code = $1
         LIMIT 1`,
        [roleCode]
      );

      if (roleResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "Le rÃ´le sÃ©lectionnÃ© n'existe pas."
        });
      }

      if (centreId !== null) {
        const centreResult = await client.query(
          `SELECT id
           FROM centres
           WHERE id = $1 AND actif = TRUE`,
          [centreId]
        );

        if (centreResult.rows.length === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Le centre sÃ©lectionnÃ© n'existe pas ou est dÃ©sactivÃ©."
          });
        }
      }

      const hash = await bcrypt.hash(motDePasse, 12);

      const insertion = await client.query(
        `INSERT INTO utilisateurs (
          identifiant,
          nom_complet,
          email,
          mot_de_passe,
          role_id,
          centre_id,
          actif
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING id, identifiant, nom_complet, email, actif, centre_id, date_creation`,
        [
          identifiant,
          nomComplet,
          email || null,
          hash,
          roleResult.rows[0].id,
          centreId
        ]
      );

      const nouvelUtilisateur = insertion.rows[0];

      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          details,
          date_action
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          req.user.id,
          centreId,
          "CREATION",
          "UTILISATEUR",
          String(nouvelUtilisateur.id),
          `CrÃ©ation du compte ${identifiant} (${roleCode})`
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Utilisateur crÃ©Ã© avec succÃ¨s.",
        utilisateur: {
          ...nouvelUtilisateur,
          role_code: roleResult.rows[0].code,
          role: roleResult.rows[0].libelle
        }
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Erreur crÃ©ation utilisateur :", error.message);

      return res.status(500).json({
        success: false,
        message: "Impossible de crÃ©er cet utilisateur."
      });

    } finally {
      if (client) client.release();
    }
  }
);

// ------------------------------------------
// MODIFICATION D'UN UTILISATEUR
// ------------------------------------------

app.patch(
  "/api/admin/utilisateurs/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const utilisateurId = Number(req.params.id);

    if (!Number.isInteger(utilisateurId) || utilisateurId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Identifiant utilisateur invalide."
      });
    }

    const identifiant = String(req.body.identifiant || "").trim();
    const nomComplet = String(
      req.body.nom_complet || req.body.nom || ""
    ).trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const roleCode = String(
      req.body.role_code || req.body.role || ""
    ).trim().toLowerCase();

    const centreValue =
      req.body.centre_id !== undefined
        ? req.body.centre_id
        : req.body.centreId;

    const centreId =
      centreValue === "" || centreValue === null || centreValue === undefined
        ? null
        : Number(centreValue);

    const motDePasse =
      req.body.motDePasse ||
      req.body.mot_de_passe ||
      req.body.password ||
      "";

    if (!identifiant || !nomComplet || !roleCode) {
      return res.status(400).json({
        success: false,
        message: "L'identifiant, le nom et le rÃ´le sont obligatoires."
      });
    }

    if (identifiant.length > 100 || nomComplet.length > 200) {
      return res.status(400).json({
        success: false,
        message: "L'identifiant ou le nom est trop long."
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "L'adresse e-mail est invalide."
      });
    }

    if (!["admin", "officier", "agent", "hopital", "consultation"].includes(roleCode)) {
      return res.status(400).json({
        success: false,
        message: "Le rÃ´le sÃ©lectionnÃ© est invalide."
      });
    }

    if (
      centreId !== null &&
      (!Number.isInteger(centreId) || centreId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Le centre sÃ©lectionnÃ© est invalide."
      });
    }

    if (motDePasse && (
      typeof motDePasse !== "string" || motDePasse.length < 8
    )) {
      return res.status(400).json({
        success: false,
        message: "Le nouveau mot de passe doit contenir au moins 8 caractÃ¨res."
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const ancienResult = await client.query(
        `SELECT id, identifiant, centre_id
         FROM utilisateurs
         WHERE id = $1
         FOR UPDATE`,
        [utilisateurId]
      );

      if (ancienResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Utilisateur introuvable."
        });
      }

      const doublon = await client.query(
        `SELECT id
         FROM utilisateurs
         WHERE id <> $1
           AND (
             LOWER(identifiant) = LOWER($2)
             OR ($3 <> '' AND LOWER(email) = LOWER($3))
           )
         LIMIT 1`,
        [utilisateurId, identifiant, email]
      );

      if (doublon.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "Cet identifiant ou cette adresse e-mail est dÃ©jÃ  utilisÃ©."
        });
      }

      const roleResult = await client.query(
        `SELECT id, code, libelle
         FROM roles
         WHERE code = $1
         LIMIT 1`,
        [roleCode]
      );

      if (roleResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "Le rÃ´le sÃ©lectionnÃ© n'existe pas."
        });
      }

      if (centreId !== null) {
        const centreResult = await client.query(
          `SELECT id
           FROM centres
           WHERE id = $1 AND actif = TRUE`,
          [centreId]
        );

        if (centreResult.rows.length === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Le centre sÃ©lectionnÃ© n'existe pas ou est dÃ©sactivÃ©."
          });
        }
      }

      let hash = null;

      if (motDePasse) {
        hash = await bcrypt.hash(motDePasse, 12);
      }

      const modification = await client.query(
        `UPDATE utilisateurs
         SET
           identifiant = $1,
           nom_complet = $2,
           email = $3,
           role_id = $4,
           centre_id = $5,
           mot_de_passe = COALESCE($6, mot_de_passe)
         WHERE id = $7
         RETURNING id, identifiant, nom_complet, email, actif, centre_id, date_creation`,
        [
          identifiant,
          nomComplet,
          email || null,
          roleResult.rows[0].id,
          centreId,
          hash,
          utilisateurId
        ]
      );

      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          details,
          date_action
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          req.user.id,
          centreId || ancienResult.rows[0].centre_id,
          "MODIFICATION",
          "UTILISATEUR",
          String(utilisateurId),
          `Modification du compte ${identifiant}`
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Utilisateur modifiÃ© avec succÃ¨s.",
        utilisateur: {
          ...modification.rows[0],
          role_code: roleResult.rows[0].code,
          role: roleResult.rows[0].libelle
        }
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Erreur modification utilisateur :", error.message);

      return res.status(500).json({
        success: false,
        message: "Impossible de modifier cet utilisateur."
      });

    } finally {
      if (client) client.release();
    }
  }
);

// ------------------------------------------
// DÃ‰SACTIVATION D'UN UTILISATEUR
// ------------------------------------------

app.patch(
  "/api/admin/utilisateurs/:id/desactiver",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    const utilisateurId = Number(req.params.id);

    if (!Number.isInteger(utilisateurId) || utilisateurId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Identifiant utilisateur invalide."
      });
    }

    if (String(req.user.id) === String(utilisateurId)) {
      return res.status(400).json({
        success: false,
        message: "Vous ne pouvez pas dÃ©sactiver votre propre compte."
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE utilisateurs
         SET actif = FALSE
         WHERE id = $1 AND actif = TRUE
         RETURNING id, identifiant, nom_complet, centre_id`,
        [utilisateurId]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Utilisateur introuvable ou dÃ©jÃ  dÃ©sactivÃ©."
        });
      }

      const utilisateur = result.rows[0];

      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          details,
          date_action
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          req.user.id,
          utilisateur.centre_id,
          "DESACTIVATION",
          "UTILISATEUR",
          String(utilisateur.id),
          `DÃ©sactivation du compte ${utilisateur.identifiant}`
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Compte utilisateur dÃ©sactivÃ© avec succÃ¨s."
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Erreur dÃ©sactivation utilisateur :", error.message);

      return res.status(500).json({
        success: false,
        message: "Impossible de dÃ©sactiver cet utilisateur."
      });

    } finally {
      if (client) client.release();
    }
  }
);


// ==========================================
// 14. LISTE DES DÃ‰CLARATIONS
// ==========================================

app.get("/api/declarations", authenticateToken, async (req, res) => {
  try {
    const { role, centreId } = req.user;

    let condition = "";
    const values = [];

    if (role === "hopital") {
      if (!centreId) {
        return res.status(403).json({
          message: "Aucun Ã©tablissement associÃ© Ã  ce compte."
        });
      }

      condition = "WHERE d.etablissement_id = $1";
      values.push(centreId);

    } else if (role !== "admin") {
      if (!centreId) {
        return res.status(403).json({
          message: "Aucun centre associÃ© Ã  ce compte."
        });
      }

      condition = "WHERE d.centre_id = $1";
      values.push(centreId);
    }

    const result = await pool.query(
      `SELECT
        d.id AS db_id,
        d.reference,
        d.nom_enfant,
        d.prenoms_enfant,
        d.sexe,
        d.date_naissance,
        d.heure_naissance,
        d.lieu_naissance,
        d.commune,
        d.province,
        d.nationalite,
        d.mere_nom,
        d.mere_date_naissance,
        d.mere_profession,
        d.mere_domicile,
        d.mere_nationalite,
        d.mere_cni,
        d.pere_nom,
        d.pere_profession,
        d.pere_nationalite,
        d.pere_cni,
        d.declarant_nom,
        d.declarant_qualite,
        d.declarant_piece,
        d.centre_id,
        d.etablissement_id,
        d.statut,
        d.date_declaration,
        d.hors_delai,
        d.observations,
        d.date_creation,
        c.nom AS centre,
        e.nom AS etablissement
      FROM declarations d
      LEFT JOIN centres c ON c.id = d.centre_id
      LEFT JOIN centres e ON e.id = d.etablissement_id
      ${condition}
      ORDER BY d.date_creation DESC`,
      values
    );

    const declarations = result.rows.map((d) => ({
      ...d,
      id: d.reference,
      nom: d.nom_enfant,
      prenoms: d.prenoms_enfant,
      heure: d.heure_naissance,
      lieu: d.lieu_naissance,
      mereNom: d.mere_nom,
      mereDateNaissance: d.mere_date_naissance,
      mereProfession: d.mere_profession,
      mereDomicile: d.mere_domicile,
      mereNationalite: d.mere_nationalite,
      mereCni: d.mere_cni,
      pereNom: d.pere_nom,
      pereProfession: d.pere_profession,
      pereNationalite: d.pere_nationalite,
      pereCni: d.pere_cni,
      declarantNom: d.declarant_nom,
      declarantQualite: d.declarant_qualite,
      declarantPiece: d.declarant_piece
    }));

    res.json({
      success: true,
      declarations
    });

  } catch (error) {
    console.error("Erreur liste dÃ©clarations :", error.message);

    res.status(500).json({
      message: "Impossible de charger les dÃ©clarations."
    });
  }
});


// ==========================================
// 15. LISTE DES ACTES DE NAISSANCE
// ==========================================

app.get("/api/actes", authenticateToken, async (req, res) => {
  try {
    const { role, centreId } = req.user;

    let condition = "";
    const values = [];

    if (role === "hopital") {
      if (!centreId) {
        return res.status(403).json({
          message: "Aucun établissement associé à ce compte."
        });
      }

      condition = "WHERE d.etablissement_id = $1";
      values.push(centreId);

    } else if (role !== "admin") {
      if (!centreId) {
        return res.status(403).json({
          message: "Aucun centre associé à ce compte."
        });
      }

      condition = "WHERE r.centre_id = $1";
      values.push(centreId);
    }

    const result = await pool.query(
      `SELECT
        a.id AS db_id,
        a.id,
        a.reference,
        a.declaration_id,
        a.jugement_id,
        a.registre_id,
        a.numero_acte,
        a.nom_enfant,
        a.prenoms_enfant,
        a.sexe,
        a.date_naissance,
        a.lieu_naissance,
        a.officier_id,
        a.date_etablissement,
        a.date_signature,
        a.statut,
        a.date_creation,
        r.reference AS registre_reference,
        r.annee AS registre_annee,
        r.centre_id,
        c.nom AS centre,
        d.etablissement_id
      FROM actes a
      INNER JOIN registres r ON r.id = a.registre_id
      LEFT JOIN centres c ON c.id = r.centre_id
      LEFT JOIN declarations d ON d.id = a.declaration_id
      ${condition}
      ORDER BY a.date_creation DESC`,
      values
    );

    res.json({
      success: true,
      actes: result.rows
    });

  } catch (error) {
    console.error("Erreur liste actes :", error.message);

    res.status(500).json({
      message: "Impossible de charger les actes."
    });
  }
});


// ==========================================
// 15. CRÃ‰ATION D'UNE DÃ‰CLARATION
// ==========================================

app.post(
  "/api/declarations",
  authenticateToken,
  authorizeRoles("hopital", "agent", "officier"),
  async (req, res) => {
    const v = req.body;

    const obligatoires = [
      "nom",
      "prenoms",
      "sexe",
      "dateNaissance",
      "lieu",
      "mereNom",
      "declarantNom",
      "centreId"
    ];

    for (const champ of obligatoires) {
      if (
        v[champ] === undefined ||
        v[champ] === null ||
        String(v[champ]).trim() === ""
      ) {
        return res.status(400).json({
          message: `Le champ ${champ} est obligatoire.`
        });
      }
    }

    if (!["M", "F"].includes(v.sexe)) {
      return res.status(400).json({
        message: "Le sexe doit Ãªtre M ou F."
      });
    }

    const centreId = Number(v.centreId);

    if (!Number.isInteger(centreId) || centreId <= 0) {
      return res.status(400).json({
        message: "Le centre destinataire est invalide."
      });
    }

    console.log("DATE REÇUE PAR LE BACKEND :", v.dateNaissance);
console.log("TYPE DE LA DATE :", typeof v.dateNaissance);

   const dateNaissanceBrute = String(v.dateNaissance ?? "").trim();

let dateNaissanceISO = dateNaissanceBrute;

if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateNaissanceBrute)) {
  const [jour, mois, annee] = dateNaissanceBrute.split("/");
  dateNaissanceISO = `${annee}-${mois}-${jour}`;
}

const dateNaissance = new Date(`${dateNaissanceISO}T00:00:00`);

const dateValide =
  /^\d{4}-\d{2}-\d{2}$/.test(dateNaissanceISO) &&
  !Number.isNaN(dateNaissance.getTime()) &&
  dateNaissance.getFullYear() === Number(dateNaissanceISO.slice(0, 4)) &&
  dateNaissance.getMonth() + 1 === Number(dateNaissanceISO.slice(5, 7)) &&
  dateNaissance.getDate() === Number(dateNaissanceISO.slice(8, 10));

if (!dateValide) {
  return res.status(400).json({
    message: "La date de naissance est invalide."
  });
}

if (dateNaissance > new Date()) {
  return res.status(400).json({
    message: "La date de naissance ne peut pas Ãªtre dans le futur."
  });
}

    if (
      v.heure &&
      !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v.heure)
    ) {
      return res.status(400).json({
        message: "L'heure de naissance est invalide."
      });
    }

    const origineHopital = req.user.role === "hopital";

    if (origineHopital && !req.user.centreId) {
      return res.status(403).json({
        message: "Aucun Ã©tablissement n'est associÃ© Ã  ce compte."
      });
    }

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      const centre = await client.query(
        `SELECT id
         FROM centres
         WHERE id = $1 AND actif = TRUE`,
        [centreId]
      );

      if (centre.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Le centre destinataire n'existe pas ou est dÃ©sactivÃ©."
        });
      }

      const reference =
        `DN-${new Date().getFullYear()}-${Date.now()}`;

      const result = await client.query(
        `INSERT INTO declarations (
          reference,
          nom_enfant,
          prenoms_enfant,
          sexe,
          date_naissance,
          heure_naissance,
          lieu_naissance,
          commune,
          province,
          nationalite,
          mere_nom,
          mere_date_naissance,
          mere_profession,
          mere_domicile,
          mere_nationalite,
          mere_cni,
          pere_nom,
          pere_profession,
          pere_nationalite,
          pere_cni,
          declarant_nom,
          declarant_qualite,
          declarant_piece,
          centre_id,
          cree_par,
          statut,
          observations,
          origine_type,
          etablissement_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,'DOSSIER_DEPOSE',
          $26,$27,$28
        )
        RETURNING id, reference, statut, date_creation`,
        [
          reference,
          v.nom.trim(),
          v.prenoms.trim(),
          v.sexe,
          dateNaissanceISO,
          v.heure || null,
          v.lieu.trim(),
          v.commune || null,
          v.province || null,
          v.nationalite || null,
          v.mereNom.trim(),
          v.mereDateNaissance || null,
          v.mereProfession || null,
          v.mereDomicile || null,
          v.mereNationalite || null,
          v.mereCni || null,
          v.pereNom || null,
          v.pereProfession || null,
          v.pereNationalite || null,
          v.pereCni || null,
          v.declarantNom.trim(),
          v.declarantQualite || null,
          v.declarantPiece || null,
          centreId,
          req.user.id,
          v.observations || null,
          origineHopital ? "HOPITAL" : "CENTRE",
          origineHopital ? req.user.centreId : null
        ]
      );

      const declaration = result.rows[0];

      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          nouvelles_donnees,
          details,
          date_action
        ) VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7, CURRENT_TIMESTAMP
        )`,
        [
          req.user.id,
          centreId,
          "CREATION",
          "DECLARATION",
          String(declaration.id),
          JSON.stringify({
            reference,
            nom: v.nom.trim(),
            prenoms: v.prenoms.trim(),
            statut: "DOSSIER_DEPOSE"
          }),
          `CrÃ©ation de la dÃ©claration ${reference}`
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "DÃ©claration enregistrÃ©e avec succÃ¨s.",
        declaration
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Erreur crÃ©ation dÃ©claration :", error.message);

      return res.status(500).json({
        message: "Impossible d'enregistrer la dÃ©claration."
      });

    } finally {
      if (client) client.release();
    }
  }
);

// ==========================================
// 16. VALIDATION ET REJET DES DECLARATIONS
// ==========================================

app.patch(
  "/api/declarations/:id/decision",
  authenticateToken,
  authorizeRoles("officier"),
  async (req, res) => {
    const declarationId = Number(req.params.id);
    const { decision, motif } = req.body;

    // Vérification de l'identifiant
    if (!Number.isSafeInteger(declarationId) || declarationId <= 0) {
      return res.status(400).json({
        message: "Identifiant de déclaration invalide."
      });
    }

    // Vérification de la décision
    if (!["VALIDER", "REJETER"].includes(decision)) {
      return res.status(400).json({
        message: "Décision invalide."
      });
    }

    // Vérification du motif de rejet
    const motifRejet =
      typeof motif === "string" ? motif.trim() : "";

    if (decision === "REJETER" && !motifRejet) {
      return res.status(400).json({
        message: "Le motif du rejet est obligatoire."
      });
    }

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      // 1. Rechercher la déclaration dans le centre de l'officier
      const resultat = await client.query(
        `SELECT id, reference, centre_id, statut, observations
         FROM declarations
         WHERE id = $1 AND centre_id = $2
         FOR UPDATE`,
        [declarationId, req.user.centreId]
      );

      if (resultat.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message: "Déclaration introuvable dans votre centre."
        });
      }

      const declaration = resultat.rows[0];

      // 2. Vérifier que la déclaration est encore à traiter
      if (declaration.statut !== "DOSSIER_DEPOSE") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          message: "Cette déclaration a déjà été traitée ou ne peut pas être traitée."
        });
      }

      // 3. Déterminer les nouveaux statuts
      const ancienStatut = declaration.statut;

      const nouveauStatut =
        decision === "VALIDER" ? "VALIDE" : "REJETE";

    // 4. Mettre à jour la déclaration
await client.query(
  `UPDATE declarations
   SET statut = $1,
       date_modification = CURRENT_TIMESTAMP,
       observations = CASE
         WHEN $2::boolean = TRUE
         THEN CONCAT(
           COALESCE(observations, ''),
           CASE
             WHEN COALESCE(observations, '') = '' THEN ''
             ELSE E'\n'
           END,
           'Motif du rejet : ',
           $3::text
         )
         ELSE observations
       END
   WHERE id = $4`,
  [
    nouveauStatut,
    decision === "REJETER",
    motifRejet,
    declarationId
  ]
);

      // 5. Enregistrer la décision dans le journal d'audit
      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          anciennes_donnees,
          nouvelles_donnees,
          details,
          date_action
        ) VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8,
          CURRENT_TIMESTAMP
        )`,
        [
          req.user.id,
          declaration.centre_id,
          decision === "VALIDER" ? "VALIDATION" : "REJET",
          "DECLARATION",
          String(declaration.id),
          JSON.stringify({
            statut: ancienStatut
          }),
          JSON.stringify({
            statut: nouveauStatut
          }),
          decision === "REJETER"
            ? `Déclaration ${declaration.reference} rejetée. Motif : ${motifRejet}`
            : `Déclaration ${declaration.reference} validée par ${req.user.nom}`
        ]
      );

      // 6. Confirmer les modifications
      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: decision === "VALIDER"
          ? "Déclaration validée avec succès."
          : "Déclaration rejetée avec succès.",
        declaration: {
          id: declaration.id,
          reference: declaration.reference,
          ancienStatut,
          statut: nouveauStatut
        }
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error(
        "Erreur décision déclaration :",
        error.message
      );

      return res.status(500).json({
        message: "Impossible d'enregistrer la décision."
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


 // ==========================================
 // 17. OUVERTURE D'UN REGISTRE DE NAISSANCES
 // ==========================================

app.post(
  "/api/registres",
  authenticateToken,
  authorizeRoles("officier"),
  async (req, res) => {
    const annee = Number(req.body.annee);
    const dateOuverture =
      req.body.dateOuverture ||
      new Date().toISOString().slice(0, 10);

    if (!req.user.centreId) {
      return res.status(403).json({
        message: "Aucun centre n'est associé à votre compte."
      });
    }

    if (
      !Number.isInteger(annee) ||
      annee < 1900 ||
      annee > 2200
    ) {
      return res.status(400).json({
        message: "Année du registre invalide."
      });
    }

    const correspondance =
      typeof dateOuverture === "string"
        ? dateOuverture.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        : null;

    const dateVerifiee = correspondance
      ? new Date(`${dateOuverture}T00:00:00Z`)
      : null;

    if (
      !correspondance ||
      Number.isNaN(dateVerifiee.getTime()) ||
      dateVerifiee.toISOString().slice(0, 10) !== dateOuverture ||
      dateVerifiee.getUTCFullYear() !== annee
    ) {
      return res.status(400).json({
        message: "La date d'ouverture doit être valide et correspondre à l'année du registre."
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const centreResult = await client.query(
        `SELECT id
         FROM centres
         WHERE id = $1 AND actif = TRUE
         FOR UPDATE`,
        [req.user.centreId]
      );

      if (centreResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Votre centre est introuvable ou inactif."
        });
      }

      const reference =
        `REG-${req.user.centreId}-${annee}-` +
        crypto.randomBytes(5).toString("hex").toUpperCase();

      const resultat = await client.query(
        `INSERT INTO registres (
          reference,
          centre_id,
          type_registre,
          annee,
          date_ouverture,
          statut,
          cree_par
        )
        VALUES ($1, $2, 'NAISSANCES', $3, $4, 'OUVERT', $5)
        RETURNING
          id,
          reference,
          centre_id,
          type_registre,
          annee,
          date_ouverture,
          statut`,
        [
          reference,
          req.user.centreId,
          annee,
          dateOuverture,
          req.user.id
        ]
      );

      const registre = resultat.rows[0];

      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          nouvelles_donnees,
          adresse_ip,
          details,
          date_action
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, CURRENT_TIMESTAMP)`,
        [
          req.user.id,
          req.user.centreId,
          "OUVERTURE",
          "REGISTRE",
          String(registre.id),
          JSON.stringify(registre),
          req.ip,
          `Ouverture du registre ${reference}`
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Registre de naissances ouvert avec succès.",
        registre
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      if (error.code === "23505") {
        return res.status(409).json({
          message: "Un registre existe déjà pour ce centre et cette année."
        });
      }

      console.error("Erreur ouverture registre :", error.message);

      return res.status(500).json({
        message: "Impossible d'ouvrir le registre."
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ==========================================
// 16. CRÉATION D'UN ACTE DE NAISSANCE
// ==========================================

app.post(
  "/api/actes",
  authenticateToken,
  authorizeRoles("officier"),
  async (req, res) => {
    let client;

    try {
      const { declarationId, registreId } = req.body;

      // Vérification des identifiants
      const declarationIdNum = Number(declarationId);
      const registreIdNum = Number(registreId);

      if (
        !Number.isSafeInteger(declarationIdNum) ||
        declarationIdNum <= 0 ||
        !Number.isSafeInteger(registreIdNum) ||
        registreIdNum <= 0
      ) {
        return res.status(400).json({
          message: "Identifiants de déclaration ou de registre invalides."
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");

      // 1. Vérifier la déclaration
      const declarationResult = await client.query(
        `SELECT
          id,
          centre_id,
          statut,
          nom_enfant,
          prenoms_enfant,
          sexe,
          date_naissance,
          lieu_naissance,
          EXTRACT(YEAR FROM date_naissance)::integer AS annee_naissance
        FROM declarations
        WHERE id = $1
        FOR UPDATE`,
        [declarationIdNum]
      );

      if (declarationResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Déclaration introuvable."
        });
      }

      const declaration = declarationResult.rows[0];

      if (Number(declaration.centre_id) !== Number(req.user.centreId)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Cette déclaration ne relève pas de votre centre."
        });
      }

      if (declaration.statut !== "VALIDE") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Seules les déclarations validées peuvent donner lieu à un acte."
        });
      }

      // 2. Vérifier le registre
      const registreResult = await client.query(
        `SELECT
          id,
          reference,
          centre_id,
          type_registre,
          annee,
          statut
        FROM registres
        WHERE id = $1
        FOR UPDATE`,
        [registreIdNum]
      );

      if (registreResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Registre introuvable."
        });
      }

      const registre = registreResult.rows[0];

      if (Number(registre.centre_id) !== Number(req.user.centreId)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          message: "Ce registre ne relève pas de votre centre."
        });
      }

      if (
        registre.type_registre !== "NAISSANCES" ||
        registre.statut !== "OUVERT"
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Le registre de naissances n'est pas ouvert."
        });
      }

      // 3. Vérifier l'année de naissance
      if (
        Number(declaration.annee_naissance) !== Number(registre.annee)
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "L'année de naissance ne correspond pas à celle du registre."
        });
      }

      // 4. Calculer le prochain numéro d'acte
      const numeroResult = await client.query(
        `SELECT COALESCE(MAX(numero_acte), 0) + 1 AS prochain_numero
         FROM actes
         WHERE registre_id = $1`,
        [registre.id]
      );

      const numeroActe = Number(numeroResult.rows[0].prochain_numero);

      // 5. Générer la référence de l'acte
      const reference =
        `ACT-${registre.annee}-${registre.centre_id}-` +
        crypto.randomBytes(5).toString("hex").toUpperCase();

      // 6. Enregistrer l'acte
      const acteResult = await client.query(
        `INSERT INTO actes (
          reference,
          declaration_id,
          registre_id,
          numero_acte,
          nom_enfant,
          prenoms_enfant,
          sexe,
          date_naissance,
          lieu_naissance,
          officier_id,
          date_etablissement,
          statut
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, CURRENT_DATE, 'ETABLI'
        )
        RETURNING *`,
        [
          reference,
          declaration.id,
          registre.id,
          numeroActe,
          declaration.nom_enfant,
          declaration.prenoms_enfant,
          declaration.sexe,
          declaration.date_naissance,
          declaration.lieu_naissance,
          req.user.id
        ]
      );

      const acte = acteResult.rows[0];

      // 7. Enregistrer l'opération dans le journal d'audit
      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          nouvelles_donnees,
          adresse_ip,
          details,
          date_action
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7, $8,
          CURRENT_TIMESTAMP
        )`,
        [
          req.user.id,
          req.user.centreId,
          "CREATION",
          "ACTE",
          String(acte.id),
          JSON.stringify(acte),
          req.ip,
          `Création de l'acte ${reference}`
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Acte de naissance créé avec succès.",
        acte
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      if (error.code === "23505") {
        return res.status(409).json({
          message: "Un acte existe déjà pour cette déclaration ou ce numéro."
        });
      }

      console.error("Erreur création acte :", error.message);

      return res.status(500).json({
        message: "Impossible de créer l'acte de naissance."
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


// ==========================================
// 17. SIGNATURE D'UN ACTE DE NAISSANCE
// ==========================================

app.post(
  "/api/actes/:id/signature",
  authenticateToken,
  authorizeRoles("officier"),
  async (req, res) => {
    let client;

    try {
      const acteId = Number(req.params.id);

      if (!Number.isSafeInteger(acteId) || acteId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Identifiant de l'acte invalide."
        });
      }

      client = await pool.connect();
      await client.query("BEGIN");

      // 1. Vérifier l'acte et verrouiller sa ligne
      const acteResult = await client.query(
        `SELECT
          a.id,
          a.reference,
          a.registre_id,
          a.numero_acte,
          a.statut,
          a.date_signature,
          r.centre_id
        FROM actes a
        INNER JOIN registres r ON r.id = a.registre_id
        WHERE a.id = $1
        FOR UPDATE OF a`,
        [acteId]
      );

      if (acteResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Acte introuvable."
        });
      }

      const acte = acteResult.rows[0];

      // 2. Vérifier le centre de l'officier
      if (Number(acte.centre_id) !== Number(req.user.centreId)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Vous ne pouvez pas signer un acte d'un autre centre."
        });
      }

      // 3. Vérifier le statut
      if (acte.statut === "SIGNE") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Cet acte est déjà signé."
        });
      }

      if (acte.statut !== "ETABLI") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Seul un acte établi peut être signé."
        });
      }

      // 4. Générer un jeton secret aléatoire
      const token = crypto.randomBytes(32).toString("hex");

      // Seule l'empreinte SHA-256 sera conservée
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // 5. Enregistrer la signature de l'acte
      const signatureResult = await client.query(
        `UPDATE actes
         SET
           statut = 'SIGNE',
           date_signature = CURRENT_TIMESTAMP,
           officier_id = $1
         WHERE id = $2
         RETURNING
           id,
           reference,
           numero_acte,
           statut,
           date_signature`,
        [req.user.id, acteId]
      );

      // 6. Enregistrer le jeton de vérification
      await client.query(
        `INSERT INTO verifications_actes (
          acte_id,
          token_hash,
          cree_par
        )
        VALUES ($1, $2, $3)`,
        [acteId, tokenHash, req.user.id]
      );

      // 7. Journal d'audit
      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          nouvelles_donnees,
          adresse_ip,
          details,
          date_action
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7, $8,
          CURRENT_TIMESTAMP
        )`,
        [
          req.user.id,
          req.user.centreId,
          "SIGNATURE",
          "ACTE",
          String(acteId),
          JSON.stringify(signatureResult.rows[0]),
          req.ip,
          `Signature de l'acte ${acte.reference}`
        ]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Acte signé avec succès.",
        acte: signatureResult.rows[0],
        verification: {
          token,
          url: `${req.protocol}://${req.get("host")}/api/verifier/${token}`
        }
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Un jeton de vérification actif existe déjà pour cet acte."
        });
      }

      console.error("Erreur signature acte :", error.message);

      return res.status(500).json({
        success: false,
        message: "Impossible de signer l'acte."
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);



// ==========================================
// RENOUVELLEMENT DU JETON QR D'UN ACTE SIGNÉ
// ==========================================

app.post(
  "/api/actes/:id/verification-token",
  authenticateToken,
  authorizeRoles("officier"),
  async (req, res) => {
    let client;

    try {
      const acteId = Number(req.params.id);

      if (!Number.isSafeInteger(acteId) || acteId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Identifiant de l'acte invalide."
        });
      }

      client = await pool.connect();
      await client.query("BEGIN");

      // 1. Vérifier l'acte
      const acteResult = await client.query(
        `SELECT
          a.id,
          a.reference,
          a.statut,
          r.centre_id
         FROM actes a
         INNER JOIN registres r ON r.id = a.registre_id
         WHERE a.id = $1
         FOR UPDATE OF a`,
        [acteId]
      );

      if (acteResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Acte introuvable."
        });
      }

      const acte = acteResult.rows[0];

      // 2. Vérifier le centre de l'officier
      if (Number(acte.centre_id) !== Number(req.user.centreId)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          success: false,
          message: "Vous ne pouvez pas renouveler le jeton d'un acte d'un autre centre."
        });
      }

      // 3. L'acte doit déjà être signé
      if (acte.statut !== "SIGNE") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Seul un acte déjà signé peut recevoir un nouveau jeton."
        });
      }

      // 4. Révoquer les anciens jetons actifs
      await client.query(
        `UPDATE verifications_actes
         SET
           date_revocation = CURRENT_TIMESTAMP,
           motif_revocation = 'Renouvellement du jeton QR'
         WHERE acte_id = $1
           AND date_revocation IS NULL`,
        [acteId]
      );

      // 5. Générer un nouveau jeton secret
      const token = crypto.randomBytes(32).toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // 6. Enregistrer uniquement son empreinte
      await client.query(
        `INSERT INTO verifications_actes (
          acte_id,
          token_hash,
          cree_par
        )
        VALUES ($1, $2, $3)`,
        [acteId, tokenHash, req.user.id]
      );

      // 7. Journaliser l'opération
      await client.query(
        `INSERT INTO journal_audit (
          utilisateur_id,
          centre_id,
          action,
          entite,
          entite_id,
          nouvelles_donnees,
          adresse_ip,
          details,
          date_action
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7, $8,
          CURRENT_TIMESTAMP
        )`,
        [
          req.user.id,
          req.user.centreId,
          "RENOUVELLEMENT_JETON_QR",
          "ACTE",
          String(acteId),
          JSON.stringify({ reference: acte.reference }),
          req.ip,
          `Renouvellement du jeton QR de l'acte ${acte.reference}`
        ]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Nouveau jeton QR généré avec succès.",
        verification: {
          token,
          url: `${req.protocol}://${req.get("host")}/api/verifier/${token}`
        }
      });

    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Erreur renouvellement jeton QR :", error.message);

      return res.status(500).json({
        success: false,
        message: "Impossible de renouveler le jeton QR."
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);


 // ==========================================
 // 17. VÉRIFICATION PUBLIQUE D'UN ACTE PAR QR CODE
 // ==========================================

app.get("/api/verifier/:token", async (req, res) => {
  try {
    const token = req.params.token;

    // 1. Vérifier le format du jeton
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        valide: false,
        message: "Code de vérification invalide."
      });
    }

    // 2. Calculer l'empreinte SHA-256 du jeton
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 3. Rechercher l'acte associé au jeton actif
    const resultat = await pool.query(
      `SELECT
        a.reference,
        a.numero_acte,
        a.nom_enfant,
        a.prenoms_enfant,
        a.sexe,
        a.date_naissance,
        a.lieu_naissance,
        a.date_signature,
        a.statut,
        c.nom AS centre_nom,
        c.ville AS centre_ville,
        v.date_creation AS date_verification
      FROM verifications_actes v
      INNER JOIN actes a ON a.id = v.acte_id
      INNER JOIN registres r ON r.id = a.registre_id
      INNER JOIN centres c ON c.id = r.centre_id
      WHERE v.token_hash = $1
        AND v.date_revocation IS NULL
      LIMIT 1`,
      [tokenHash]
    );

    // 4. Aucun acte correspondant
    if (resultat.rows.length === 0) {
      return res.status(404).json({
        success: false,
        valide: false,
        message: "Acte introuvable ou code de vérification révoqué."
      });
    }

    const acte = resultat.rows[0];

    // 5. Vérifier que l'acte est bien signé
    if (acte.statut !== "SIGNE" || !acte.date_signature) {
      return res.status(409).json({
        success: false,
        valide: false,
        message: "Cet acte n'est pas signé."
      });
    }

    // 6. Réponse publique limitée aux informations nécessaires
    return res.status(200).json({
      success: true,
      valide: true,
      message: "Acte authentifié : signature enregistrée dans le système e-Naissance.",
      acte: {
        reference: acte.reference,
        numero_acte: acte.numero_acte,
        nom_enfant: acte.nom_enfant,
        prenoms_enfant: acte.prenoms_enfant,
        sexe: acte.sexe,
        date_naissance: acte.date_naissance,
        lieu_naissance: acte.lieu_naissance,
        date_signature: acte.date_signature,
        statut: acte.statut,
        centre: {
          nom: acte.centre_nom,
          ville: acte.centre_ville
        }
      }
    });

  } catch (error) {
    console.error("Erreur vérification QR Code :", error.message);

    return res.status(500).json({
      success: false,
      valide: false,
      message: "Impossible de vérifier cet acte pour le moment."
    });
  }
});



// ==========================================
// 16. GESTION DES ERREURS
// ==========================================

app.use((err, req, res, next) => {
  console.error("Erreur serveur :", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    message: "Erreur interne du serveur."
  });
});

// ==========================================
// 17. DÃ‰MARRAGE DU SERVEUR
// ==========================================

const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Serveur e-Naissance dÃ©marrÃ© sur http://127.0.0.1:${PORT}`
  );
});

server.on("error", (error) => {
  console.error("Impossible de dÃ©marrer le serveur :", error.message);
  process.exit(1);
});

// ==========================================
// 18. ARRÃŠT PROPRE
// ==========================================

async function shutdown() {
  console.log("ArrÃªt du serveur e-Naissance...");

  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error("Erreur pendant l'arrÃªt :", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

