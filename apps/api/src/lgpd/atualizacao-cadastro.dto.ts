import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * O que o titular pode completar pelo link pessoal (ADR-034). Tudo é opcional:
 * campo ausente fica como está; CPF/CNPJ em branco mantém o documento já gravado.
 */
export class AtualizacaoCadastroDto {
  @IsOptional()
  @IsIn(['PF', 'PJ'])
  tipoPessoa?: 'PF' | 'PJ';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complemento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;
}
