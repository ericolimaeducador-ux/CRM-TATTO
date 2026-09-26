import { useParams } from 'react-router-dom';
import { TelaTermo } from './TelaTermo';

export function PaginaAutocadastro() {
  const { token = '' } = useParams();
  return <TelaTermo modo="autocadastro" token={token} />;
}
