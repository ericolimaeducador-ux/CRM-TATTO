import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AutocadastroDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsBoolean()
  contatoComercial?: boolean;

  @IsOptional()
  @IsBoolean()
  envioErp?: boolean;

  @IsOptional()
  @IsString()
  emDispositivo?: string;

  @IsOptional()
  @IsString()
  captchaId?: string;

  @IsOptional()
  @IsString()
  captchaResposta?: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}

export class ConsentimentoDto {
  @IsOptional()
  @IsBoolean()
  contatoComercial?: boolean;

  @IsOptional()
  @IsString()
  emDispositivo?: string;
}
