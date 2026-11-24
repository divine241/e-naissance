
BEGIN;

-- ============================================================
-- E-NAISSANCE : MIGRATION 001
-- Création des tables métier
-- Les tables centres, roles et utilisateurs sont conservées.
-- ============================================================

-- 1. DECLARATIONS DE NAISSANCE
CREATE TABLE IF NOT EXISTS declarations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference VARCHAR(50) NOT NULL UNIQUE,

    nom_enfant VARCHAR(150) NOT NULL,
    prenoms_enfant VARCHAR(200) NOT NULL,
    sexe VARCHAR(20) NOT NULL CHECK (sexe IN ('M', 'F')),
    date_naissance DATE NOT NULL,
    heure_naissance TIME,
    lieu_naissance VARCHAR(200) NOT NULL,
    commune VARCHAR(100),
    province VARCHAR(100),
    nationalite VARCHAR(100),

    mere_nom VARCHAR(150) NOT NULL,
    mere_date_naissance DATE,
    mere_profession VARCHAR(150),
    mere_domicile TEXT,
    mere_nationalite VARCHAR(100),
    mere_cni VARCHAR(100),

    pere_nom VARCHAR(150),
    pere_profession VARCHAR(150),
    pere_nationalite VARCHAR(100),
    pere_cni VARCHAR(100),

    declarant_nom VARCHAR(150) NOT NULL,
    declarant_qualite VARCHAR(100),
    declarant_piece VARCHAR(150),

    centre_id INTEGER NOT NULL REFERENCES centres(id),
    agent_id INTEGER REFERENCES utilisateurs(id),
    cree_par INTEGER NOT NULL REFERENCES utilisateurs(id),

    statut VARCHAR(60) NOT NULL DEFAULT 'DOSSIER_DEPOSE',
    date_declaration DATE NOT NULL DEFAULT CURRENT_DATE,
    delai_jours INTEGER,
    hors_delai BOOLEAN NOT NULL DEFAULT FALSE,

    observations TEXT,
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_declarations_centre
ON declarations(centre_id);

CREATE INDEX IF NOT EXISTS idx_declarations_statut
ON declarations(statut);

CREATE INDEX IF NOT EXISTS idx_declarations_date
ON declarations(date_naissance);


-- 2. CERTIFICATS DE NAISSANCE
CREATE TABLE IF NOT EXISTS certificats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference VARCHAR(50) NOT NULL UNIQUE,
    numero_certificat VARCHAR(100),

    nom_enfant VARCHAR(150) NOT NULL,
    prenoms_enfant VARCHAR(200),
    sexe VARCHAR(20),
    date_naissance DATE NOT NULL,
    heure_naissance TIME,
    lieu_naissance VARCHAR(200),

    nom_mere VARCHAR(150),
    nom_pere VARCHAR(150),

    centre_id INTEGER NOT NULL REFERENCES centres(id),
    declaration_id BIGINT REFERENCES declarations(id),

    statut VARCHAR(40) NOT NULL DEFAULT 'RECU',
    date_emission DATE,
    emis_par INTEGER REFERENCES utilisateurs(id),
    cree_par INTEGER NOT NULL REFERENCES utilisateurs(id),

    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificats_centre
ON certificats(centre_id);


-- 3. JUGEMENTS SUPPLETIFS
CREATE TABLE IF NOT EXISTS jugements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference VARCHAR(50) NOT NULL UNIQUE,

    enfant VARCHAR(200) NOT NULL,
    requerant VARCHAR(200) NOT NULL,
    juridiction VARCHAR(200) NOT NULL,

    date_jugement DATE,
    date_reception DATE,
    date_naissance_retenue DATE NOT NULL,
    lieu_retenu VARCHAR(200) NOT NULL,
    filiation TEXT,
    dispositif TEXT,

    centre_id INTEGER NOT NULL REFERENCES centres(id),
    statut VARCHAR(60) NOT NULL DEFAULT 'JUGEMENT_RENDU',

    cree_par INTEGER NOT NULL REFERENCES utilisateurs(id),
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jugements_centre
ON jugements(centre_id);

CREATE INDEX IF NOT EXISTS idx_jugements_statut
ON jugements(statut);


-- 4. REGISTRES
CREATE TABLE IF NOT EXISTS registres (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,

    centre_id INTEGER NOT NULL REFERENCES centres(id),
    type_registre VARCHAR(50) NOT NULL DEFAULT 'NAISSANCES',
    annee INTEGER NOT NULL CHECK (annee BETWEEN 1900 AND 2200),

    date_ouverture DATE NOT NULL,
    date_cloture DATE,
    statut VARCHAR(30) NOT NULL DEFAULT 'OUVERT'
        CHECK (statut IN ('OUVERT', 'CLOTURE')),

    cree_par INTEGER NOT NULL REFERENCES utilisateurs(id),
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (centre_id, type_registre, annee)
);


-- 5. ACTES DE NAISSANCE
CREATE TABLE IF NOT EXISTS actes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,

    declaration_id BIGINT UNIQUE REFERENCES declarations(id),
    jugement_id BIGINT UNIQUE REFERENCES jugements(id),

    registre_id BIGINT NOT NULL REFERENCES registres(id),
    numero_acte INTEGER NOT NULL,

    nom_enfant VARCHAR(150) NOT NULL,
    prenoms_enfant VARCHAR(200) NOT NULL,
    sexe VARCHAR(20) NOT NULL CHECK (sexe IN ('M', 'F')),
    date_naissance DATE NOT NULL,
    lieu_naissance VARCHAR(200) NOT NULL,

    officier_id INTEGER REFERENCES utilisateurs(id),
    date_etablissement DATE,
    date_signature TIMESTAMP,

    statut VARCHAR(30) NOT NULL DEFAULT 'ETABLI'
        CHECK (statut IN ('BROUILLON', 'ETABLI', 'SIGNE', 'ANNULE')),

    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        (declaration_id IS NOT NULL AND jugement_id IS NULL)
        OR
        (declaration_id IS NULL AND jugement_id IS NOT NULL)
    ),

    UNIQUE (registre_id, numero_acte)
);


-- 6. RECTIFICATIONS
CREATE TABLE IF NOT EXISTS rectifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference VARCHAR(50) NOT NULL UNIQUE,

    acte_id BIGINT NOT NULL REFERENCES actes(id),
    champ VARCHAR(150) NOT NULL,
    ancienne_valeur TEXT NOT NULL,
    nouvelle_valeur TEXT NOT NULL,
    motif TEXT NOT NULL,

    decision VARCHAR(200),
    autorite VARCHAR(200),

    statut VARCHAR(40) NOT NULL DEFAULT 'EN_INSTRUCTION',

    demande_par INTEGER NOT NULL REFERENCES utilisateurs(id),
    valide_par INTEGER REFERENCES utilisateurs(id),

    date_demande TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_validation TIMESTAMP
);


-- 7. MENTIONS MARGINALES
CREATE TABLE IF NOT EXISTS mentions_marginales (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reference VARCHAR(50) NOT NULL UNIQUE,

    acte_id BIGINT NOT NULL REFERENCES actes(id),
    type_mention VARCHAR(100) NOT NULL,
    date_decision DATE NOT NULL,
    autorite VARCHAR(200) NOT NULL,
    reference_document VARCHAR(200),
    contenu TEXT NOT NULL,

    cree_par INTEGER NOT NULL REFERENCES utilisateurs(id),
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- 8. DOCUMENTS ET PIECES JUSTIFICATIVES
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    nom_original VARCHAR(255) NOT NULL,
    cle_stockage VARCHAR(500) NOT NULL UNIQUE,
    type_mime VARCHAR(150) NOT NULL,
    taille_octets BIGINT NOT NULL CHECK (taille_octets > 0),
    empreinte_sha256 VARCHAR(64),

    declaration_id BIGINT REFERENCES declarations(id),
    certificat_id BIGINT REFERENCES certificats(id),
    jugement_id BIGINT REFERENCES jugements(id),
    acte_id BIGINT REFERENCES actes(id),
    rectification_id BIGINT REFERENCES rectifications(id),
    mention_id BIGINT REFERENCES mentions_marginales(id),

    categorie VARCHAR(100) NOT NULL,
    depose_par INTEGER NOT NULL REFERENCES utilisateurs(id),
    date_depot TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        num_nonnulls(
            declaration_id,
            certificat_id,
            jugement_id,
            acte_id,
            rectification_id,
            mention_id
        ) = 1
    )
);


-- 9. JOURNAL D'AUDIT
CREATE TABLE IF NOT EXISTS journal_audit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    utilisateur_id INTEGER REFERENCES utilisateurs(id),
    centre_id INTEGER REFERENCES centres(id),

    action VARCHAR(100) NOT NULL,
    entite VARCHAR(100) NOT NULL,
    entite_id VARCHAR(100),

    anciennes_donnees JSONB,
    nouvelles_donnees JSONB,

    adresse_ip INET,
    details TEXT,

    date_action TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_utilisateur
ON journal_audit(utilisateur_id);

CREATE INDEX IF NOT EXISTS idx_audit_date
ON journal_audit(date_action);

CREATE INDEX IF NOT EXISTS idx_audit_entite
ON journal_audit(entite, entite_id);


COMMIT;
