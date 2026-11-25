import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizacaoCadastroDto {
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
  @MaxLength(100)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;
}
