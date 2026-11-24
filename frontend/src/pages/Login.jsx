
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  ArrowRight,
  Check,
  FileCheck2,
  ShieldCheck,
  Search,
  AlertCircle,
  LifeBuoy,
  Archive,
  Timer,
} from "lucide-react";

import Logo, { LogoMark } from "../components/Logo.jsx";
import { FlagStripe, LogoLoader } from "../components/Brand.jsx";
import { CountUp } from "../components/ui.jsx";
import { useAuth } from "../auth.jsx";

const CENTRES = [
  "Libreville — 1er arrondissement",
  "Libreville — 3e arrondissement",
  "Owendo",
  "Akanda",
  "Ntoum",
];

const FEATURES = [
  { icon: FileCheck2, label: "Déclarations et actes" },
  { icon: ShieldCheck, label: "Traçabilité complète" },
  { icon: Search, label: "Recherche instantanée" },
];

/** Aperçu décoratif d'un acte de naissance (côté gauche). */
function ActePreview() {
  return (
    <div className="lviz" aria-hidden="true">
      <motion.div
        className="lviz__acte"
        initial={{ opacity: 0, y: 30, rotate: -2 }}
        animate={{ opacity: 1, y: [0, -8, 0], rotate: -2 }}
        transition={{
          opacity: { duration: 0.6, delay: 0.3 },
          y: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.9,
          },
        }}
      >
        <FlagStripe className="lviz__stripe" />

        <div className="lviz__head">
          <div>
            <div className="lviz__kicker">
              République Gabonaise · État civil
            </div>
            <div className="lviz__title">Acte de naissance</div>
          </div>
          <span className="lviz__num">N°2026-1254</span>
        </div>

        <div className="lviz__lines">
          {[
            ["Nom", "NZÉ"],
            ["Prénom(s)", "Junior Patrick"],
            ["Né le", "19/10/2026 à Libreville"],
          ].map(([k, v]) => (
            <div key={k} className="lviz__line">
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>

        <div className="lviz__foot">
          <span className="lviz__signed">
            <Check size={13} strokeWidth={3} /> Signé par l'officier
          </span>

          <motion.span
            className="lviz__seal"
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              delay: 1,
              stiffness: 260,
              damping: 14,
            }}
          >
            <LogoMark size={44} animated={false} />
          </motion.span>
        </div>
      </motion.div>

      <motion.div
        className="lviz__chip lviz__chip--a"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0, y: [0, 6, 0] }}
        transition={{
          opacity: { delay: 0.7 },
          x: { delay: 0.7 },
          y: {
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.2,
          },
        }}
      >
        <span className="lviz__chip-icon lviz__chip-icon--green">
          <Archive size={16} />
        </span>
        <div>
          <strong>
            <CountUp value={2841} />
          </strong>
          <span>actes archivés en 2026</span>
        </div>
      </motion.div>

      <motion.div
        className="lviz__chip lviz__chip--b"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, y: [0, -6, 0] }}
        transition={{
          opacity: { delay: 0.9 },
          x: { delay: 0.9 },
          y: {
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.4,
          },
        }}
      >
        <span className="lviz__chip-icon lviz__chip-icon--yellow">
          <Timer size={16} />
        </span>
        <div>
          <strong>
            <CountUp value={94} /> %
          </strong>
          <span>déclarations dans le délai</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const shake = useAnimationControls();

  const [form, setForm] = useState({
    identifiant: "",
    motDePasse: "",
    centre: CENTRES[0],
    souvenir: true,
  });

  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState("idle");

  const update = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]:
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.value,
    }));

  const submit = async (e) => {
    e.preventDefault();

    if (state !== "idle") return;

    if (!form.identifiant.trim() || !form.motDePasse) {
      setError(
        "Veuillez saisir votre identifiant et votre mot de passe."
      );

      shake.start({
        x: [0, -10, 10, -7, 7, -3, 0],
        transition: { duration: 0.45 },
      });

      return;
    }

    setError("");
    setState("loading");

    try {
      // Vérification réelle auprès du serveur backend.
      await login(form.identifiant, form.motDePasse);

      setState("success");

      await new Promise((resolve) => setTimeout(resolve, 650));

      setState("redirect");

      await new Promise((resolve) => setTimeout(resolve, 1500));

      navigate("/");
    } catch (err) {
      setState("idle");

      setError(
        err.message || "Identifiant ou mot de passe incorrect."
      );

      shake.start({
        x: [0, -10, 10, -7, 7, -3, 0],
        transition: { duration: 0.45 },
      });
    }
  };

  const busy = state !== "idle";

  return (
    <div className="login">
      <aside className="login__aside">
        <FlagStripe className="login__stripe" />

        <div className="login__dots" aria-hidden="true" />

        <div className="login__watermark" aria-hidden="true">
          <LogoMark size={420} animated={false} />
        </div>

        <motion.div
          className="login__brand"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Logo />
          <span className="login__tag">
            <span className="login__tag-dot" />
            Espace des centres d'état civil
          </span>
        </motion.div>

        <div className="login__pitch">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Gestion numérique des{" "}
            <span className="login__hl">
              actes de naissance
              <FlagStripe className="login__hl-bar" />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            Déclaration, établissement, conservation et délivrance
            des actes, dans un registre numérique sécurisé.
          </motion.p>
        </div>

        <ActePreview />

        <div className="login__bottom">
          <ul className="login__pills">
            {FEATURES.map(({ icon: Icon, label }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
              >
                <Icon size={15} /> {label}
              </motion.li>
            ))}
          </ul>

          <div className="login__legal">
            Conforme à la loi n°008/2022 portant organisation de
            l'état civil
          </div>
        </div>
      </aside>

      <main className="login__main">
        <div className="login__topline">
          <span className="login__secure">
            <Lock size={13} /> Connexion sécurisée
          </span>

          <a
            href="#"
            className="login__help-link"
            onClick={(e) => e.preventDefault()}
          >
            <LifeBuoy size={15} /> Assistance
          </a>
        </div>

        <motion.div
          className="login__card-in"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <motion.div className="login__card" animate={shake}>
            <div className="login__mobile-logo">
              <Logo light={false} />
            </div>

            <div className="login__heading">
              <h2 className="login__title">Bon retour</h2>
              <p className="login__subtitle">
                Connectez-vous à votre espace e-Naissance.
              </p>
            </div>

            <form onSubmit={submit} noValidate>
              <label className="field">
                <span className="field__label">Identifiant</span>

                <span className="field__control">
                  <User size={17} />

                  <input
                    value={form.identifiant}
                    onChange={update("identifiant")}
                    placeholder="Ex. : Officier01"
                    autoComplete="username"
                    disabled={busy}
                  />
                </span>
              </label>

              <label className="field">
                <span className="field__label">
                  Mot de passe

                  <a
                    href="#"
                    className="field__link"
                    onClick={(e) => e.preventDefault()}
                  >
                    Oublié ?
                  </a>
                </span>

                <span className="field__control">
                  <Lock size={17} />

                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.motDePasse}
                    onChange={update("motDePasse")}
                    placeholder="Votre mot de passe"
                    autoComplete="current-password"
                    disabled={busy}
                  />

                  <button
                    type="button"
                    className="field__eye"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={
                      showPwd
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPwd ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </span>
              </label>

              <label className="field">
                <span className="field__label">
                  Centre d'état civil
                </span>

                <span className="field__control">
                  <MapPin size={17} />

                  <select
                    value={form.centre}
                    onChange={update("centre")}
                    disabled={busy}
                  >
                    {CENTRES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </span>
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  checked={form.souvenir}
                  onChange={update("souvenir")}
                  disabled={busy}
                />

                <span className="check__box">
                  <Check size={13} />
                </span>

                Se souvenir de moi sur ce poste
              </label>

              <AnimatePresence>
                {error && (
                  <motion.div
                    className="login__error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <AlertCircle size={16} /> {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="login__submit-wrap">
                <button
                  type="submit"
                  className={`login__submit is-${state}`}
                  aria-busy={busy}
                >
                  <AnimatePresence initial={false}>
                    {state === "idle" && (
                      <motion.span
                        key="idle"
                        className="login__layer login__submit-text"
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          transition: { delay: 0.25 },
                        }}
                        exit={{
                          opacity: 0,
                          transition: { duration: 0.08 },
                        }}
                      >
                        Se connecter <ArrowRight size={18} />
                      </motion.span>
                    )}

                    {state === "loading" && (
                      <motion.span
                        key="loading"
                        className="login__layer"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          transition: {
                            delay: 0.3,
                            duration: 0.25,
                          },
                        }}
                        exit={{
                          opacity: 0,
                          transition: { duration: 0.12 },
                        }}
                      >
                        <LogoLoader size={40} />
                      </motion.span>
                    )}

                    {(state === "success" ||
                      state === "redirect") && (
                      <motion.span
                        key="ok"
                        className="login__layer login__ok"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 22,
                        }}
                      >
                        <Check size={24} strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>

              <p className="login__status" aria-live="polite">
                {state === "loading"
                  ? "Vérification de vos accès…"
                  : state === "success" || state === "redirect"
                    ? "Connexion réussie"
                    : " "}
              </p>
            </form>
          </motion.div>
        </motion.div>

        <p className="login__foot">
          © 2026 e-Naissance · Version 1.0 · Problème de connexion ?
          Contactez l'administrateur de votre centre.
        </p>
      </main>

      <AnimatePresence>
        {state === "redirect" && (
          <motion.div
            className="login__overlay"
            initial={{ clipPath: "circle(0% at 75% 60%)" }}
            animate={{ clipPath: "circle(150% at 75% 60%)" }}
            transition={{
              duration: 0.7,
              ease: [0.65, 0, 0.35, 1],
            }}
          >
            <FlagStripe className="login__overlay-stripe" />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <LogoLoader
                size={96}
                label={`Bienvenue, ${form.identifiant}. Ouverture de votre espace…`}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
