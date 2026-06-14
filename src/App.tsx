import EndScreen from './components/EndScreen'
import GameScreen from './components/GameScreen'
import TitleScreen from './components/TitleScreen'
import { useGame } from './hooks/useGame'

export default function App() {
  const { state, dispatch } = useGame()

  return (
    <div className="app">
      {state.phase === 'title' && <TitleScreen onStart={() => dispatch({ type: 'START' })} />}

      {(state.phase === 'playing' || state.phase === 'review' || state.phase === 'promotion') && (
        <GameScreen state={state} dispatch={dispatch} />
      )}

      {state.phase === 'ended' && (
        <EndScreen
          state={state}
          onReplay={() => dispatch({ type: 'START' })}
          onTitle={() => dispatch({ type: 'RESET' })}
        />
      )}

      <footer className="app__footer">
        『変数を見極めろ』— ノイズ込みの観測から隠れた係数構造を推定するゲーム
      </footer>
    </div>
  )
}
