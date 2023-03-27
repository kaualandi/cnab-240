const fs = require("fs");
const { parse } = require("csv-parse");
const readline = require('readline');
const yaml = require('js-yaml');

const nomeArquivo = 'CC3012A00.RET';
if (!nomeArquivo) {
	throw new Error("Nome do arquivo não informado.");
}

let grupo = null;
const estrutura = {};
const tiposEstrutura = {};

const carregaEstrutura = () => new Promise((resolve, reject) => {
	fs.createReadStream("layout-cnab-240.csv")
		.pipe(parse({ delimiter: ";" }))
		.on("data", function (row) {
			const isLinhaConteudo = (/^\d/).test(row[0]);
			const isLinhaGrupo = row[0] && row[0] !== 'SEQ';
			if (isLinhaConteudo) {
				const nome = row[10];
				const sequencia = row[0];
				const chave = row[0] + ' ' + nome;
				estrutura[grupo][chave] = {
					sequencia,
					inicio: row[1],
					fim: row[2],
					digitos: row[3],
					decimais: row[4],
					formato: row[5],
					nome
				};

				const partes = (/Tipo de Registro: '(\w+)'/).exec(nome);
				if (partes) {
					tiposEstrutura[partes[1]] = grupo;
				}
			} else if (isLinhaGrupo) {
				grupo = row[0];
				estrutura[grupo] = {};
			}
		})
		.on("end", () => {
			const estruturaFinal = Object.fromEntries(Object.entries(tiposEstrutura)
				.map(([k, v]) => [k, estrutura[v]]));
			resolve(estruturaFinal);
		});
});

const carregaArquivoRemessa = nome => new Promise((resolve, reject) => {
	const linhas = [];
	
	readline.createInterface({
		input: fs.createReadStream(nome)
	})
	.on("line", line => linhas.push(line))
	.on("close", () => resolve(linhas));	
});

const separaCampos = (linhas, estrutura) => linhas.map((linha, idx) => {
	const tipoLinha = linha[7];
	const estruturaLinha = estrutura[tipoLinha];
	return {
		linha: idx,
		tipo: tipoLinha,
		dados: Object.fromEntries(Object.values(estruturaLinha).map(campo => [
			campo.sequencia,
			linha.substring(campo.inicio - 1, campo.fim)
		]))
	};	
});

const salvaYml = (nome, objeto) => new Promise((resolve, reject) => {
	const yamlDump = yaml.dump(objeto);
	fs.writeFile(nome, yamlDump, err => {
		if (err) {
			reject(err);
		}
		resolve(yamlDump);
	});	
});

const salvaJson = (nome, objeto) => new Promise((resolve, reject) => {
	const jsonDump = JSON.stringify(objeto);
	fs.writeFile(nome, jsonDump, err => {
		if (err) {
			reject(err);
		}
		resolve(jsonDump);
	});
});
  
carregaEstrutura().then(estrutura => {
	carregaArquivoRemessa(nomeArquivo)
	.then(linhas => separaCampos(linhas, estrutura))
	.then(resultado => {
		salvaYml(nomeArquivo + '.yaml', resultado);
		salvaJson(nomeArquivo + '.json', resultado);
	});
});