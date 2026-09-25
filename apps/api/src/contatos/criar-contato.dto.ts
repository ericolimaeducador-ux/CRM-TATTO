import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import type { Aviso } from '../normalizacao/avisos';

export class OrigemDto {
  @IsOptional()
  @IsString()
  modo?: string;

  @IsOptional()
  @IsString()
  payloadBruto?: string;
}

export class CriarContatoDto {
  @IsOptional()
  @IsString()
  idLocal?: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  nomeSocial?: string;

  @IsOptional()
  @IsString()
  tipoPessoa?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  logradouro?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  uf?: string;

  @IsOptional()
  @IsString()
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OrigemDto)
  origem?: OrigemDto;

  avisosEstrutura?: Aviso[];
}

export class PatchContatoDto {
  @IsOptional()
  @IsString()
  campo?: string;

  @IsOptional()
  valor?: unknown;

  @IsOptional()
  @IsNumber()
  versaoConhecida?: number;

  avisosEstrutura?: Aviso[];
}

export class TransicaoDto {
  @IsOptional()
  @IsString()
  para?: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class LoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriarContatoDto)
  itens!: CriarContatoDto[];

  @IsOptional()
  @IsNumber()
  profundidade?: number;
}
