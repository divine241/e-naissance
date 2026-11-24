require("dotenv").config();

const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const db = new Pool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 55432,
    database: process.env.DB_NAME || "enaissance",
    user: process.env.DB_USER || "enaissance",
    password: process.env.DB_PASSWORD
});

const comptes = [
    {
        identifiant: "Admin01",
        nom: "MOUNGUENGUI Alice",
        role: "admin",
        centre: null
    },
    {
        identifiant: "Officier01",
        nom: "OBAME Christian",
        role: "officier",
        centre: "Libreville — 1er arrondissement"
    },
    {
        identifiant: "Agent01",
        nom: "NZIENGUI Béatrice",
        role: "agent",
        centre: "Libreville — 1er arrondissement"
    },
    {
        identifiant: "Hopital01",
        nom: "Maternité de Libreville",
        role: "hopital",
        centre: "Maternité de Libreville"
    },
    {
        identifiant: "Consult01",
        nom: "LEYAMA Corinne",
        role: "consultation",
        centre: "Akanda"
    }
];

async function creerComptes() {
    try {
        for (const compte of comptes) {
            const motDePasse = crypto.randomBytes(12).toString("base64url");
            const hash = await bcrypt.hash(motDePasse, 12);

            const role = await db.query(
                "SELECT id FROM roles WHERE code = $1",
                [compte.role]
            );

            if (role.rows.length === 0) {
                throw new Error("Rôle introuvable : " + compte.role);
            }

            let centreId = null;

            if (compte.centre) {
                const centre = await db.query(
                    "SELECT id FROM centres WHERE nom = $1",
                    [compte.centre]
                );

                if (centre.rows.length === 0) {
                    throw new Error("Centre introuvable : " + compte.centre);
                }

                centreId = centre.rows[0].id;
            }

            const resultat = await db.query(
                `INSERT INTO utilisateurs
                (identifiant, nom_complet, mot_de_passe, role_id, centre_id)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (identifiant) DO NOTHING
                RETURNING id`,
                [
                    compte.identifiant,
                    compte.nom,
                    hash,
                    role.rows[0].id,
                    centreId
                ]
            );

            if (resultat.rows.length > 0) {
                console.log("\nCompte créé : " + compte.identifiant);
                console.log("Mot de passe temporaire : " + motDePasse);
            } else {
                console.log("\nCompte déjà existant : " + compte.identifiant);
            }
        }

        console.log("\nCréation terminée.");
    } catch (error) {
        console.error("Erreur :", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

creerComptes();