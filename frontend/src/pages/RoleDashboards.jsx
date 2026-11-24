
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users, Building2, LogIn, ShieldAlert, DatabaseBackup, Activity, ChevronRight, UserPlus, Settings, Search,
  ShieldCheck, CheckCircle2, X, History, Stethoscope, FilePlus2, Send, Clock, FileCheck2, Baby, SearchX,
} from "lucide-react";
import Hero from "../components/Hero.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { Panel, StatCard, StatusBadge, stagger } from "../components/ui.jsx";
import { Badge, Person, fmtDate } from "../components/ResourcePage.jsx";
import { actes, certificats, declarations } from "../data/resources.jsx";
import { rowScope } from "../data/scope.js";

function Bars({ data }) {
  const max = Math.max(1, ...data.map((c) => Number(c.total) || 0));

  return (
    <ul className="hbars">
      {data.map((c, i) => (
        <li key={c.centre} className="hbars__row">
          <div className="hbars__top">
            <span className="hbars__label">{c.centre}</span>
            <span className="hbars__value">
              {Number(c.total || 0).toLocaleString("fr-FR")}
            </span>
          </div>
          <span className="hbars__track">
            <motion.span
              className="hbars__fill"
              initial={{ width: 0 }}
              animate={{ width: `${((Number(c.total) || 0) / max) * 100}%` }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.08 }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ items }) {
  return (
    <ul className="timeline">
      {items.map((a, i) => (
        <motion.li
          key={i}
          className="timeline__row"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.06 }}
        >
          <span className="timeline__icon">
            <a.icon size={14} />
          </span>
          <div className="timeline__body">
            <div>{a.text}</div>
            <div className="timeline__meta">{a.meta}</div>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

/* =========================== ADMINISTRATEUR =========================== */

export function AdminDashboard({ user }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let annule = false;

    async function chargerDashboard() {
      try {
        setLoading(true);
        setError("");

        const token = sessionStorage.getItem("token");

        if (!token) {
          throw new Error("Votre session a expiré. Veuillez vous reconnecter.");
        }

        const response = await fetch(
          "http://127.0.0.1:7000/api/admin/dashboard",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Impossible de récupérer les données administrateur."
          );
        }

        if (!annule) {
          setDashboard(data);
        }
      } catch (err) {
        if (!annule) {
          setError(err.message || "Une erreur est survenue.");
        }
      } finally {
        if (!annule) {
          setLoading(false);
        }
      }
    }

    chargerDashboard();

    return () => {
      annule = true;
    };
  }, []);

  const stats = dashboard?.statistiques;
  const naissances = dashboard?.naissances_par_centre || [];
  const journalRecent = dashboard?.journal_recent || [];
  const utilisateursRecents = dashboard?.utilisateurs_recents || [];

  const naissancesTotal = naissances.reduce(
    (total, centre) => total + Number(centre.total || 0),
    0
  );

  const journalItems = journalRecent.map((item) => ({
    icon: History,
    text: (
      <>
        <strong>{item.utilisateur || "Utilisateur"}</strong>{" "}
        {item.action || "Opération"} ({item.entite || "Activité"})
      </>
    ),
    meta: [
      item.date_action
        ? new Date(item.date_action).toLocaleString("fr-FR")
        : "",
      item.centre || "",
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <motion.div
      className="page"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <Hero
        title={`Bonjour, ${user.identifiant}`}
        text={
          <>
            Administration de la plateforme :{" "}
            <strong>
              {loading
                ? "Chargement des données..."
                : `${stats?.utilisateurs_actifs ?? 0} comptes actifs`}
            </strong>
            .
          </>
        }
        actions={
          <>
            <Link to="/utilisateurs" className="btn btn--white">
              <UserPlus size={16} /> Gérer les utilisateurs
            </Link>
            <Link to="/parametres" className="btn btn--ghost">
              <Settings size={16} /> Paramètres
            </Link>
          </>
        }
      />

      <div className="page__head">
        <div>
          <h2 className="section-title">Supervision</h2>
          <p className="page__subtitle">
            Comptes, centres et activité de la plateforme
          </p>
        </div>
      </div>

      {loading && (
        <Panel title="Chargement des statistiques">
          <p className="muted">
            Récupération des données depuis la base PostgreSQL...
          </p>
        </Panel>
      )}

      {error && (
        <Panel title="Erreur de chargement">
          <div className="error-message">{error}</div>
          <button
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            Réessayer
          </button>
        </Panel>
      )}

      {dashboard && (
        <>
          <motion.div className="stats stats--4" variants={stagger}>
            <StatCard
              label="Utilisateurs actifs"
              value={Number(stats?.utilisateurs_actifs || 0)}
              note={`${stats?.utilisateurs_total || 0} comptes au total`}
              icon={Users}
            />

            <StatCard
              label="Centres actifs"
              value={Number(stats?.centres_actifs || 0)}
              note={`${stats?.centres_total || 0} centres au total`}
              icon={Building2}
            />

            <StatCard
              label="Opérations aujourd'hui"
              value={Number(stats?.operations_aujourdhui || 0)}
              note="Journal d'audit"
              icon={Activity}
            />

            <StatCard
              label="Naissances enregistrées"
              value={naissancesTotal}
              note="Total des déclarations"
              icon={Baby}
            />
          </motion.div>

          <div className="grid grid--2-1">
            <Panel
              title="Comptes utilisateurs"
              subtitle="Les 10 comptes les plus récemment créés"
              action={
                <Link to="/utilisateurs" className="link">
                  Gérer <ChevronRight size={14} />
                </Link>
              }
            >
              {utilisateursRecents.length > 0 ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Utilisateur</th>
                        <th>E-mail</th>
                        <th>Rôle</th>
                        <th>Centre</th>
                        <th>Statut</th>
                      </tr>
                    </thead>

                    <tbody>
                      {utilisateursRecents.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <Person
                              name={u.nom_complet || "Nom non renseigné"}
                              sub={u.identifiant}
                            />
                          </td>

                          <td>{u.email || "Non renseigné"}</td>

                          <td>{u.role || "Non défini"}</td>

                          <td>{u.centre || "Non affecté"}</td>

                          <td>
                            <Badge tone={u.actif ? "green" : "muted"}>
                              {u.actif ? "Actif" : "Inactif"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={Users}
                  title="Aucun utilisateur trouvé"
                  text="Les comptes utilisateurs apparaîtront ici."
                />
              )}
            </Panel>

            <Panel
              title="Activité par centre"
              subtitle="Naissances enregistrées"
            >
              {naissances.length > 0 ? (
                <Bars data={naissances} />
              ) : (
                <EmptyState
                  compact
                  icon={Building2}
                  title="Aucune naissance enregistrée"
                  text="Les statistiques apparaîtront après l'enregistrement des déclarations."
                />
              )}
            </Panel>
          </div>

          <div className="grid grid--3">
            <Panel
              title="Sauvegardes"
              subtitle="Suivi des sauvegardes de la base de données"
            >
              <EmptyState
                compact
                icon={DatabaseBackup}
                title="Suivi non connecté"
                text="L'historique des sauvegardes n'est pas encore enregistré dans l'application."
              />
            </Panel>

            <Panel
              title="Alertes de sécurité"
              subtitle="Surveillance des accès"
            >
              <EmptyState
                compact
                icon={ShieldAlert}
                title="Surveillance non connectée"
                text="Les alertes de sécurité ne sont pas encore disponibles."
              />
            </Panel>

            <Panel
              title="Journal récent"
              action={
                <Link to="/journal" className="link">
                  Journal <ChevronRight size={14} />
                </Link>
              }
            >
              {journalItems.length > 0 ? (
                <Timeline items={journalItems} />
              ) : (
                <EmptyState
                  compact
                  icon={History}
                  title="Aucune activité enregistrée"
                  text="Les opérations effectuées apparaîtront ici."
                />
              )}
            </Panel>
          </div>
        </>
      )}
    </motion.div>
  );
}

/* =========================== CONSULTATION =========================== */

export function ConsultDashboard({ user }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const results = useMemo(
    () =>
      needle.length < 2
        ? []
        : actes.rows.filter((a) =>
            `${a.id} ${a.enfant} ${a.registre}`
              .toLowerCase()
              .includes(needle)
          ),
    [needle]
  );

  return (
    <motion.div
      className="page"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <Hero
        title={`Bonjour, ${user.identifiant}`}
        text={
          <>
            Accès en <strong>consultation</strong> : vous pouvez rechercher
            un acte et consulter les informations autorisées.
          </>
        }
      >
        <div className="hero-search">
          <Search size={20} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="N° d'acte, nom de l'enfant, registre… (ex. : NZÉ, 1254)"
            autoFocus
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Effacer">
              <X size={16} />
            </button>
          )}
        </div>
      </Hero>

      <Panel
        title="Résultats de recherche"
        subtitle={
          needle.length < 2
            ? "Saisissez au moins 2 caractères"
            : `${results.length} acte(s) trouvé(s)`
        }
        action={
          <Link to="/actes" className="link">
            Tous les actes <ChevronRight size={14} />
          </Link>
        }
      >
        <AnimatePresence mode="wait">
          {needle.length < 2 ? (
            <EmptyState
              key="idle"
              icon={Search}
              title="Lancez une recherche"
              text="Les actes correspondant à votre recherche s'afficheront ici."
            />
          ) : results.length === 0 ? (
            <EmptyState
              key="none"
              icon={SearchX}
              title="Aucun acte trouvé"
              text={`Aucun acte ne correspond à « ${q} ». Vérifiez l'orthographe ou le numéro.`}
            />
          ) : (
            <motion.div
              key="res"
              className="table-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>N° d'acte</th>
                    <th>Enfant</th>
                    <th>Né(e) le</th>
                    <th>Registre</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((a) => (
                    <tr key={a.id}>
                      <td className="mono strong">{a.id}</td>
                      <td>
                        <Person
                          name={a.enfant}
                          sub={a.sexe === "F" ? "Fille" : "Garçon"}
                          tone={a.sexe}
                        />
                      </td>
                      <td>{fmtDate(a.dateNaissance)}</td>
                      <td className="mono muted">{a.registre}</td>
                      <td>
                        <StatusBadge statut={a.statut} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>

      <div className="grid grid--2-1">
        <Panel title="Mes consultations récentes">
          <EmptyState
            compact
            icon={History}
            title="Aucune consultation récente"
            text="Les actes que vous consultez apparaîtront ici."
          />
        </Panel>

        <Panel title="Vos droits" subtitle={user.roleLabel}>
          <ul className="rights">
            <li className="is-ok">
              <CheckCircle2 size={16} /> Recherche d'actes
            </li>
            <li className="is-ok">
              <CheckCircle2 size={16} /> Consultation des actes autorisés
            </li>
            <li className="is-no">
              <X size={16} /> Création ou modification
            </li>
            <li className="is-no">
              <X size={16} /> Délivrance de copies
            </li>
          </ul>
        </Panel>
      </div>
    </motion.div>
  );
}

/* =========================== ÉTABLISSEMENT DE SANTÉ =========================== */

const CERT_TONE = {
  "Brouillon": "muted",
  "Transmis au centre": "blue",
  "En attente de déclaration": "yellow",
  "Déclaré": "green",
};

export function HospitalDashboard({ user }) {
  const rows = certificats.rows;
  const count = (s) => rows.filter((r) => r.statut === s).length;

  return (
    <motion.div
      className="page"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <Hero
        title={user.nom}
        text={
          <>
            Établissez le <strong>certificat de naissance</strong> de chaque
            nouveau-né et transmettez-le au centre d'état civil.{" "}
            <strong>{count("Brouillon")} brouillon</strong> à finaliser.
          </>
        }
        actions={
          <>
            <Link to="/naissances/nouvelle" className="btn btn--white">
              <FilePlus2 size={16} /> Nouvelle déclaration
            </Link>
            <Link to="/certificats" className="btn btn--ghost">
              <Stethoscope size={16} /> Certificats
            </Link>
          </>
        }
        kpis={[
          {
            icon: Clock,
            value: 2,
            suffix: " h",
            label: "Délai moyen de transmission",
          },
          {
            icon: ShieldCheck,
            value: 100,
            suffix: " %",
            label: "Certificats délivrés gratuitement",
          },
        ]}
      />

      <motion.div className="stats stats--4" variants={stagger}>
        <StatCard
          label="Naissances ce mois"
          value={rows.length}
          trend={+8}
          note="Maternité de Libreville"
          spark={[3, 4, 5, 4, 6, 5, 6, 7]}
          icon={Baby}
        />
        <StatCard
          label="Transmis au centre"
          value={count("Transmis au centre")}
          trend={+5}
          note="Reçus par l'état civil"
          spark={[1, 1, 2, 1, 2, 1, 1, 1]}
          icon={Send}
        />
        <StatCard
          label="En attente de déclaration"
          value={count("En attente de déclaration")}
          trend={-10}
          invert
          note="La famille doit se présenter"
          spark={[4, 3, 3, 4, 3, 3, 2, 2]}
          icon={Clock}
        />
        <StatCard
          label="Déclarations finalisées"
          value={count("Déclaré")}
          trend={+20}
          note="Actes en cours d'établissement"
          spark={[1, 1, 2, 2, 2, 3, 3, 3]}
          icon={FileCheck2}
        />
      </motion.div>

      <Panel
        title="Derniers certificats"
        subtitle="Suivi de la déclaration par le centre d'état civil"
        action={
          <Link to="/certificats" className="link">
            Gérer <ChevronRight size={14} />
          </Link>
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>N° certificat</th>
                <th>Nouveau-né</th>
                <th>Né(e) le</th>
                <th>Mère</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono strong">{r.id}</td>
                  <td>
                    <Person
                      name={r.enfant}
                      sub={`${r.sexe === "F" ? "Fille" : "Garçon"} · ${r.poids} kg`}
                      tone={r.sexe}
                    />
                  </td>
                  <td>
                    {fmtDate(r.dateNaissance)} à {r.heure}
                  </td>
                  <td>{r.mere}</td>
                  <td>
                    <Badge tone={CERT_TONE[r.statut]}>{r.statut}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Déclarations de naissance"
        subtitle="Naissances survenues dans l'établissement et suivies par le centre d'état civil"
        action={
          <Link to="/naissances" className="link">
            Gérer <ChevronRight size={14} />
          </Link>
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>N° dossier</th>
                <th>Enfant</th>
                <th>Né(e) le</th>
                <th>Déclarant</th>
                <th>Statut au centre</th>
              </tr>
            </thead>
            <tbody>
              {declarations.rows
                .filter(rowScope("declarations", user))
                .map((d) => (
                  <tr key={d.id}>
                    <td className="mono strong">{d.id}</td>
                    <td>
                      <Person
                        name={`${d.nom} ${d.prenoms}`}
                        sub={d.sexe === "F" ? "Fille" : "Garçon"}
                        tone={d.sexe}
                      />
                    </td>
                    <td>{fmtDate(d.dateNaissance)}</td>
                    <td>
                      {d.declarantNom}{" "}
                      <span className="muted small">
                        ({d.declarantQualite})
                      </span>
                    </td>
                    <td>
                      <StatusBadge statut={d.statut} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid--2-1">
        <Panel
          title="Retours du centre d'état civil"
          subtitle="Demandes de complément ou de correction"
        >
          <EmptyState
            compact
            icon={CheckCircle2}
            title="Aucun retour en attente"
            text="Le centre d'état civil n'a demandé aucune correction sur vos certificats."
          />
        </Panel>

        <Panel title="Rappel réglementaire">
          <p className="rule">
            Loi n°004/2021 : les établissements de santé délivrent{" "}
            <strong>gratuitement et sans délai</strong> le certificat de
            naissance. La famille dispose de <strong>2 semaines</strong>{" "}
            (commune) ou <strong>1 mois</strong> (autres lieux) pour déclarer
            la naissance.
          </p>
        </Panel>
      </div>
    </motion.div>
  );
}
