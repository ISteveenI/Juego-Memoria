"use client";

import { useState, useRef, useEffect } from "react";
import "./globals.css";

const COLORS = ["red", "blue", "green", "yellow"];

const sounds = typeof window !== "undefined" ? {
  start: new Audio("/sounds/start.mp3"),
  click: new Audio("/sounds/click.mp3"),
  error: new Audio("/sounds/error.mp3"),
  restart: new Audio("/sounds/restart.mp3"),
  pause: new Audio("/sounds/pause.mp3"),
} : {};

// Configuración de la API
const API_KEY = "$2a$10$MlzmsmYqAXXSO3PhpBd8tOW/UK.afNRWagjYYXvtBIfpLB1MpyWSW";
const BIN_ID = "696e947643b1c97be93b7595";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

export default function App() {
  const [sequence, setSequence] = useState([]);
  const [playerSeq, setPlayerSeq] = useState([]);
  const [score, setScore] = useState(0);
  const [record, setRecord] = useState(0);
  const [recordHolder, setRecordHolder] = useState("");
  const [globalRankings, setGlobalRankings] = useState([]);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [state, setState] = useState("start");
  const [active, setActive] = useState(null);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [showGlobalRankings, setShowGlobalRankings] = useState(false);

  const pausedRef = useRef(false);

  // Cargar récord local y rankings globales al iniciar
  useEffect(() => {
    const savedRecord = Number(localStorage.getItem("record")) || 0;
    const savedName = localStorage.getItem("recordHolder") || "";
    setRecord(savedRecord);
    setRecordHolder(savedName);
    
    // Cargar rankings globales
    fetchGlobalRankings();
  }, []);

  // Obtener rankings globales desde la API
  const fetchGlobalRankings = async () => {
    setLoadingRankings(true);
    try {
      const response = await fetch(API_URL + "/latest", {
        method: "GET",
        headers: {
          "X-Master-Key": API_KEY,
        },
      });
      
      const data = await response.json();
      const rankings = data.record.rankings || [];
      
      // Ordenar por puntaje descendente y tomar top 10
      const sortedRankings = rankings
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      setGlobalRankings(sortedRankings);
    } catch (error) {
      console.error("Error al obtener rankings:", error);
      setGlobalRankings([]);
    } finally {
      setLoadingRankings(false);
    }
  };

  // Enviar puntaje a la API
  const sendScoreToAPI = async (name, score) => {
    try {
      // Primero obtener los rankings actuales
      const getResponse = await fetch(API_URL + "/latest", {
        method: "GET",
        headers: {
          "X-Master-Key": API_KEY,
        },
      });
      
      const currentData = await getResponse.json();
      const currentRankings = currentData.record.rankings || [];
      
      // Agregar el nuevo puntaje
      const newEntry = {
        name: name,
        score: score,
        date: new Date().toISOString(),
      };
      
      const updatedRankings = [...currentRankings, newEntry];
      
      // Actualizar la base de datos
      await fetch(API_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": API_KEY,
        },
        body: JSON.stringify({
          rankings: updatedRankings,
        }),
      });
      
      // Recargar rankings
      await fetchGlobalRankings();
    } catch (error) {
      console.error("Error al enviar puntaje:", error);
    }
  };

  const playSound = (name) => {
    if (sounds[name]) {
      sounds[name].currentTime = 0;
      sounds[name].play();
    }
  };

  const startGame = () => {
    playSound("start");
    setSequence([]);
    setPlayerSeq([]);
    setScore(0);
    setIsNewRecord(false);
    setShowNameInput(false);
    setShowGlobalRankings(false);
    nextRound([]);
  };

  const nextRound = (seq) => {
    const next = COLORS[Math.floor(Math.random() * 4)];
    const newSeq = [...seq, next];
    setSequence(newSeq);
    setPlayerSeq([]);
    showPattern(newSeq);
  };

  const showPattern = async (seq) => {
    setState("showing");
    pausedRef.current = false;

    for (const color of seq) {
      while (pausedRef.current) {
        await wait(100);
      }
      setActive(color);
      playSound("click");
      await wait(600);
      setActive(null);
      await wait(300);
    }
    setState("playing");
  };

  const handleClick = (color) => {
    if (state !== "playing") return;

    playSound("click");

    const newPlayer = [...playerSeq, color];
    setPlayerSeq(newPlayer);

    const index = newPlayer.length - 1;
    if (newPlayer[index] !== sequence[index]) {
      gameOver();
      return;
    }

    if (newPlayer.length === sequence.length) {
      setScore((s) => s + 1);
      setTimeout(() => nextRound(sequence), 800);
    }
  };

  const togglePause = () => {
    playSound("pause");

    if (state === "paused") {
      pausedRef.current = false;
      setState("playing");
    } else {
      pausedRef.current = true;
      setState("paused");
    }
  };

  const gameOver = () => {
    playSound("error");
    setState("gameover");

    if (score > record) {
      setIsNewRecord(true);
      setShowNameInput(true);
    }
  };

  const saveRecord = async () => {
    const name = playerName.trim() || "Anónimo";
    setRecord(score);
    setRecordHolder(name);
    localStorage.setItem("record", score);
    localStorage.setItem("recordHolder", name);
    
    // Enviar puntaje a la API global
    await sendScoreToAPI(name, score);
    
    setShowNameInput(false);
  };

  const restart = () => {
    playSound("restart");
    setState("start");
    setSequence([]);
    setPlayerSeq([]);
    setScore(0);
    setIsNewRecord(false);
    setShowNameInput(false);
    setPlayerName("");
    setShowGlobalRankings(false);
  };

  const toggleGlobalRankings = () => {
    setShowGlobalRankings(!showGlobalRankings);
    if (!showGlobalRankings) {
      fetchGlobalRankings();
    }
  };

  return (
    <div className="app">
      <h1>Juego de Memoria</h1>

      {state !== "gameover" && <h2>Puntaje: {score}</h2>}

      {state === "start" && <p>Presiona iniciar para jugar</p>}
      {state === "playing" && <p>Tu turno</p>}
      {state === "showing" && <p>Observa el patrón</p>}
      {state === "paused" && <p>⏸ Juego en pausa</p>}

      {state === "gameover" && (
        <>
          <h2 className="gameover">GAME OVER</h2>
          {isNewRecord && <p className="new-record">🎉 ¡Nuevo récord!</p>}
          
          {showNameInput ? (
            <div className="name-input-container">
              <p>¡Felicidades! Ingresa tu nombre:</p>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Tu nombre"
                maxLength={20}
                className="name-input"
                autoFocus
              />
              <button onClick={saveRecord} className="save-button">
                Guardar Récord
              </button>
            </div>
          ) : (
            <div className="record-container">
              <h3 className="record-title">TU RÉCORD PERSONAL</h3>
              <p className="record-score">{record}</p>
              {recordHolder && (
                <p className="record-holder">👑 {recordHolder}</p>
              )}
              <p className="your-score">Puntaje actual: {score}</p>
            </div>
          )}
        </>
      )}

      <div className="board">
        {COLORS.map((c) => (
          <div
            key={c}
            className={`tile ${c} ${active === c ? "dim" : ""} ${
              state === "paused" ? "disabled" : ""
            }`}
            onClick={() => handleClick(c)}
          />
        ))}
      </div>

      <div className="controls">
        {state === "start" && (
          <>
            <button onClick={startGame}>Iniciar Juego</button>
            <button onClick={toggleGlobalRankings} className="rankings-btn">
              {showGlobalRankings ? "Ocultar Rankings" : "🏆 Rankings Globales"}
            </button>
          </>
        )}

        {(state === "playing" || state === "showing" || state === "paused") && (
          <button onClick={togglePause}>
            {state === "paused" ? "Reanudar" : "Pausa"}
          </button>
        )}

        {state === "gameover" && !showNameInput && (
          <>
            <button onClick={restart}>Volver</button>
            <button onClick={toggleGlobalRankings} className="rankings-btn">
              {showGlobalRankings ? "Ocultar Rankings" : "🏆 Rankings Globales"}
            </button>
          </>
        )}
      </div>

      {/* Rankings Globales */}
      {showGlobalRankings && (
        <div className="global-rankings">
          <h3>🌍 RANKINGS GLOBALES</h3>
          {loadingRankings ? (
            <p className="loading">Cargando rankings...</p>
          ) : globalRankings.length > 0 ? (
            <div className="rankings-list">
              {globalRankings.map((entry, index) => (
                <div key={index} className="ranking-item">
                  <span className="rank">#{index + 1}</span>
                  <span className="rank-name">{entry.name}</span>
                  <span className="rank-score">{entry.score}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-rankings">¡Sé el primero en el ranking!</p>
          )}
          <button onClick={fetchGlobalRankings} className="refresh-btn">
            🔄 Actualizar
          </button>
        </div>
      )}
    </div>
  );
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

