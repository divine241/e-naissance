
import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldX,
  Search,
  ArrowLeft,
  QrCode,
  FileText,
  Fingerprint,
} from "lucide-react";

import Logo from "../components/Logo.jsx";
import { FlagStripe, LogoLoader } from "../components/Brand.jsx";
import { fmt } from "../documents/format.js";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:14975/api";

/** Page publique de vérification des actes e-Naissance. */
export default function Verify() {
  const [params] = useSearchParams();
  const [input, setInput] = useState(params.get("t") ?? "");
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);

    const scannerRef = useRef(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const run = async (value = input) => {
    const raw = value.trim();
    if (!raw) return;

    setState("loading");
    setResult(null);

    try {
      let token = raw;

      // Accepte aussi un lien complet contenant ?t=...
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const url = new URL(raw);
        token = url.searchParams.get("t") || "";
      }

      // Le véritable jeton serveur contient 64 caractères hexadécimaux.
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        setResult({
          valide: false,
          message: "Jeton invalide. Veuillez scanner le QR code du document ou saisir le jeton complet.",
        });
        setState("done");
        return;
      }

      const response = await fetch(
        `${API_URL}/verifier/${encodeURIComponent(token)}`
      );

      const data = await response.json();

      setResult(data);
      setState("done");
    } catch (error) {
      console.error("Erreur de vérification :", error);

      setResult({
        valide: false,
        message: "Impossible de contacter le serveur e-Naissance. Vérifiez que le serveur est démarré.",
      });

      setState("done");
    }
  };

    const demarrerScanner = async () => {
    try {
      setScannerError("");

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          await arreterScanner();
          setInput(decodedText);
          run(decodedText);
        },
        () => {}
      );

      setScannerActive(true);
    } catch (error) {
      console.error("Erreur caméra :", error);
      setScannerError(
        "Impossible d'activer la caméra. Vérifiez les autorisations du navigateur."
      );
      setScannerActive(false);
    }
  };

  const arreterScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      scannerRef.current?.clear();
      scannerRef.current = null;
    } catch (error) {
      console.error("Erreur arrêt caméra :", error);
    }

    setScannerActive(false);
  };

  useEffect(() => {
      const demarrerScanner = async () => {
    try {
      setScannerError("");

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          await arreterScanner();
          setInput(decodedText);
          run(decodedText);
        },
        () => {}
      );

      setScannerActive(true);
    } catch (error) {
      console.error("Erreur caméra :", error);
      setScannerError(
        "Impossible d'activer la caméra. Vérifiez les autorisations du navigateur."
      );
      setScannerActive(false);
    }
  };

  const arreterScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      scannerRef.current?.clear();
      scannerRef.current = null;
    } catch (error) {
      console.error("Erreur arrêt caméra :", error);
    }

    setScannerActive(false);
  };
    const token = params.get("t");
    if (token) run(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acte = result?.acte;

  return (
    <div className="verify">
      <FlagStripe className="verify__stripe" />

      <header className="verify__top">
        <Logo light={false} />
        <Link to="/connexion" className="link">
          <ArrowLeft size={14} /> Espace agents
        </Link>
      </header>

      <main className="verify__main">
        <motion.div
          className="verify__card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="verify__badge">
            <ShieldCheck size={14} /> Service public de vérification
          </span>

          <h1>Vérifier un document d'état civil</h1>

          <p className="verify__intro">
            Scannez le QR code du document ou saisissez le jeton de
            vérification imprimé sous le QR code.
          </p>

          <form
            className="verify__form"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <div className="verify__input">
              <QrCode size={18} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Jeton de vérification ou lien QR code"
              />
            </div>

            <button
              className="btn btn--primary"
              disabled={state === "loading"}
            >
              <Search size={16} /> Vérifier
            </button>
                    </form>

          {/* Scanner QR code */}
          <div className="verify__scanner">
            <div
              id="qr-reader"
              style={{
                width: "100%",
                maxWidth: "400px",
                margin: "16px auto",
              }}
            />

            {!scannerActive ? (
              <button
                type="button"
                className="btn btn--outline"
                onClick={demarrerScanner}
              >
                <QrCode size={16} /> Activer le scanner
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--outline"
                onClick={arreterScanner}
              >
                Arrêter le scanner
              </button>
            )}

            {scannerError && (
              <p className="verify__error">{scannerError}</p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {state === "loading" && (
              <motion.div
                key="loading"
                className="verify__loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LogoLoader
                  size={64}
                  label="Vérification auprès du serveur e-Naissance…"
                />
              </motion.div>
            )}

            {state === "done" && result && (
              <motion.div
                key={`result-${result.valide}`}
                className={`verify__result ${
                  result.valide ? "is-ok" : "is-ko"
                }`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="verify__result-head">
                  <motion.span
                    className="verify__result-icon"
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 14,
                    }}
                  >
                    {result.valide ? (
                      <ShieldCheck size={26} />
                    ) : (
                      <ShieldX size={26} />
                    )}
                  </motion.span>

                  <div>
                    <strong>
                      {result.valide
                        ? "Acte authentique"
                        : "Acte non vérifié"}
                    </strong>
                    <span>{result.message}</span>
                  </div>
                </div>

                {result.valide && acte && (
                  <dl className="verify__dl">
                    <div>
                      <dt><FileText size={14} /> Référence</dt>
                      <dd>{acte.reference}</dd>
                    </div>

                    <div>
                      <dt>Numéro de l'acte</dt>
                      <dd>{acte.numero_acte}</dd>
                    </div>

                    <div>
                      <dt>Nom de l'enfant</dt>
                      <dd>{acte.nom_enfant} {acte.prenoms_enfant}</dd>
                    </div>

                    <div>
                      <dt>Sexe</dt>
                      <dd>{acte.sexe || "Non renseigné"}</dd>
                    </div>

                    <div>
                      <dt>Date de naissance</dt>
                      <dd>{fmt(acte.date_naissance)}</dd>
                    </div>

                    <div>
                      <dt>Lieu de naissance</dt>
                      <dd>{acte.lieu_naissance || "Non renseigné"}</dd>
                    </div>

                    <div>
                      <dt>Date de signature</dt>
                      <dd>{fmt(acte.date_signature)}</dd>
                    </div>

                    <div>
                      <dt>Centre d'état civil</dt>
                      <dd>
                        {acte.centre?.nom || "Non renseigné"}
                        {acte.centre?.ville
                          ? ` - ${acte.centre.ville}`
                          : ""}
                      </dd>
                    </div>

                    <div>
                      <dt>Statut</dt>
                      <dd>{acte.statut}</dd>
                    </div>

                    <div>
                      <dt><Fingerprint size={14} /> Jeton contrôlé</dt>
                      <dd className="mono">
                        {input.length >= 16
                          ? `${input.slice(0, 16)}…`
                          : "Vérification serveur"}
                      </dd>
                    </div>
                  </dl>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="verify__note">
          La vérification est effectuée directement auprès du serveur
          e-Naissance. Le système contrôle le jeton enregistré et le statut
          de signature de l'acte dans la base de données.
        </p>
      </main>
    </div>
  );
}
