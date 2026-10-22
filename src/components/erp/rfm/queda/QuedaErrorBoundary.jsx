import { Component } from "react";

// Impede que uma falha de renderização desta análise derrube a página inteira (tela branca).
export default class QuedaErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bg-gray-900 border border-red-900/50 rounded-xl p-4 text-sm text-red-300">
        Não foi possível exibir a análise de queda ({String(this.state.error?.message || this.state.error)}).
        <button onClick={() => this.setState({ error: null })} className="ml-2 underline text-violet-300">Tentar novamente</button>
      </div>
    );
  }
}