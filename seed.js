const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "data", "playbook.db");
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Remove old DB if exists
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS columns (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, emoji TEXT DEFAULT '', position INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY AUTOINCREMENT, column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE, label TEXT DEFAULT '', label_class TEXT DEFAULT 'label-abordagem', title TEXT NOT NULL, description TEXT DEFAULT '', content TEXT DEFAULT '', position INTEGER NOT NULL DEFAULT 0);
`);

const insertCol = db.prepare("INSERT INTO columns (title, emoji, position) VALUES (?, ?, ?)");
const insertCard = db.prepare("INSERT INTO cards (column_id, label, label_class, title, description, content, position) VALUES (?,?,?,?,?,?,?)");

function col(title, emoji, pos) { return insertCol.run(title, emoji, pos).lastInsertRowid; }
function card(colId, label, labelClass, title, desc, content, pos) { insertCard.run(colId, label, labelClass, title, desc, content, pos); }

const tx = db.transaction(() => {

// ═══════ COL 1 ═══════
const c1 = col("Contato Inicial", "📣", 0);
card(c1,"ABORDAGEM","label-abordagem","👩‍💻 Abordagem Inicial","Como se apresentar e identificar a dor",`<h3>Objetivo</h3><p>Apresentar-se, identificar a dor e conduzir para a construção de autoridade em no máximo 2 mensagens.</p><span class="tag-when">Usar: quando o lead entra pela primeira vez</span><h3>Mensagem 1 — Apresentação + Dor</h3><div class="msg-box good">Olá, [Nome]! Sou a Letícia, assistente da Dra. Natália Penteado. Que bom que você entrou em contato! 😊<br><br>O que mais te incomoda hoje?<br>• Expressão cansada<br>• Perda de contorno<br>• Olhar pesado<br>• Nariz<br>• Outro</div><p><strong>Por que funciona:</strong> as opções facilitam a resposta. Pergunta aberta gera silêncio.</p><h3>Se a pessoa mandou só "Oi"</h3><div class="msg-box good">Olá! Sou a Letícia, assistente da Dra. Natália. O que mais te incomoda hoje na sua aparência?</div><h3>Se a mensagem não carregou (erro Kommo)</h3><div class="msg-box good">Oi, [Nome]! Sua mensagem não carregou por aqui. Me conta: o que mais te incomoda hoje?</div><h3>⚠️ Regras</h3><ul><li><strong>Sempre texto, nunca áudio.</strong></li><li><strong>Se quiser ligar:</strong> ligue direto, não peça permissão.</li><li><strong>Responda em menos de 5 minutos.</strong></li></ul>`,0);

card(c1,"ABORDAGEM","label-abordagem","🔨 Construção de Autoridade","Apresentar a doutora e o Protocolo Revera",`<h3>Objetivo</h3><p>Apresentar a diferenciação da Dra. Natália em 2–3 mensagens curtas e separadas.</p><span class="tag-when">Usar: logo após a paciente responder a dor</span><h3>Mensagem 2 — Autoridade</h3><div class="msg-box good">A Dra. Natália tem 14 anos de experiência e 3 formações acadêmicas. Especialista em restauração facial estratégica.</div><h3>Mensagem 3 — Método (adaptar à dor)</h3><p><strong>Se "expressão cansada":</strong></p><div class="msg-box good">Ela trabalha com o Protocolo Revera Face, que restaura a estrutura facial preservando a naturalidade. O primeiro passo é a entrega de um diagnóstico: ela mapeia o que restaurar, o que manter e o que nunca tocar.</div><p><strong>Se "flacidez / levantar o rosto":</strong></p><div class="msg-box good">A doutora é especialista em procedimentos minimamente invasivos que atenuam as expressões da idade, trazendo mais jovialidade e naturalidade.</div><p><strong>Se medo de ficar artificial:</strong></p><div class="msg-box good">A proposta da doutora é justamente preservar a naturalidade. Por isso ela trabalha com o Protocolo Revera, onde o primeiro passo é entender não só o que vai mudar, mas o que vai ser preservado.</div><h3>⚡ Regra de ouro</h3><p>Personalize com base na dor. Se ela disse "72 anos", fale em "jovialidade". Se disse "não quero cirurgia", fale em "minimamente invasivo".</p>`,1);

card(c1,"ABORDAGEM","label-abordagem","📅 Agendamento da Consulta","Fechar a consulta de diagnóstico (R$ 400)",`<h3>Mensagem 4 — Valor + Pergunta</h3><div class="msg-box good">A próxima etapa é agendar a consulta para a entrega do seu diagnóstico. A consulta é R$ 400. Qual seria o melhor horário para você?</div><h3>⚠️ Detalhes críticos</h3><ul><li><strong>Não esconda o valor.</strong> R$ 400 é o preço. Ponto.</li><li><strong>Use "entrega de diagnóstico"</strong> em vez de "avaliação".</li><li><strong>Termine com "Qual o melhor horário?"</strong></li></ul><h3>Se perguntar valor do procedimento</h3><div class="msg-box good">Como o trabalho é personalizado, a doutora analisa caso a caso. Temos procedimentos dentro do Protocolo Revera que partem de R$ 1.500.</div><h3>Se perguntar parcelamento</h3><div class="msg-box good">Sim, o protocolo pode ser parcelado no boleto. A doutora monta um planejamento financeiro junto com o diagnóstico.</div>`,2);

card(c1,"EXEMPLO","label-abordagem","✍️ Exemplo: Fluxo Completo","Conversa real do início ao agendamento",`<h3>Cenário</h3><p>Lead do Meta Ads. Mulher, 52 anos, Higienópolis.</p><div class="msg-box">Lead: "Oi, tenho interesse."</div><div class="msg-box good">Letícia: "Olá! Sou a Letícia, assistente da Dra. Natália Penteado. 😊 O que mais te incomoda hoje?<br>• Expressão cansada<br>• Perda de contorno<br>• Olhar pesado<br>• Nariz<br>• Outro"</div><div class="msg-box">Lead: "Expressão cansada e perda de contorno."</div><div class="msg-box good">Letícia: "A Dra. Natália tem 14 anos de experiência e 3 formações. Especialista em restauração facial estratégica."</div><div class="msg-box good">Letícia: "Ela trabalha com o Protocolo Revera Face. O primeiro passo é a entrega de um diagnóstico onde ela mapeia o que restaurar, manter e nunca tocar."</div><div class="msg-box good">Letícia: "A próxima etapa é agendar a entrega do diagnóstico. A consulta é R$ 400. Qual o melhor horário?"</div><div class="msg-box">Lead: "Pode ser quarta à tarde?"</div><div class="msg-box good">Letícia: "Perfeito! Reservei quarta às 15h. Te envio confirmação. 🤍"</div><p><strong>Total: 5 mensagens. Direto, personalizado.</strong></p>`,3);

// ═══════ COL 2 ═══════
const c2 = col("Follow-Up", "🔛", 1);
card(c2,"FOLLOW-UP","label-followup","📋 Cadência de Follow-Up","Regras de espaçamento e timing",`<h3>Princípio</h3><p>Decisão de compra em estética leva até 3 meses. Follow-up é conversar, não cobrar.</p><h3>Cadência</h3><ul><li><strong>FU 1:</strong> 3 dias → Case ou vídeo relacionado à dor.</li><li><strong>FU 2:</strong> 7 dias → Conteúdo do Instagram.</li><li><strong>FU 3:</strong> 10 dias → Último contato suave.</li><li><strong>Após o 3º:</strong> Descarte. "Perdido: sem retorno".</li></ul><h3>Exceção</h3><p>Se a paciente deu data ("só recebo dia 24"), siga a data exata.</p>`,0);

card(c2,"FOLLOW-UP","label-followup","💬 FU 1 — Case Relacionado","3 dias depois · Conteúdo de valor",`<span class="tag-when">3 dias após última interação</span><h3>Se dor = expressão cansada</h3><div class="msg-box good">Oi, [Nome]! Lembrei de você — a doutora publicou conteúdo sobre como a perda de estrutura causa a "cara de cansada". [link]</div><h3>Se dor = preenchimento labial</h3><div class="msg-box good">Oi, [Nome]! A doutora publicou um caso de lábios que ficou muito natural. Te envio. [link]</div><h3>Se dor = medo de artificial</h3><div class="msg-box good">Oi, [Nome]! Vi conteúdo da doutora sobre a diferença entre harmonização e restauração. [link]</div>`,1);

card(c2,"FOLLOW-UP","label-followup","💬 FU 2 — Referência Suave","7 dias depois",`<span class="tag-when">7 dias após o 1º FU</span><div class="msg-box good">Oi, [Nome]! A doutora explica nesse vídeo como funciona o diagnóstico facial antes de qualquer procedimento. Achei que combinava. [link]</div>`,2);

card(c2,"FOLLOW-UP","label-followup","💬 FU 3 — Último Contato","10 dias depois · Encerramento",`<span class="tag-when">10 dias após o 2º FU</span><div class="msg-box good">[Nome], se precisar, estou por aqui! A agenda da doutora é limitada, então quando decidir, me avise. 🤍</div><p><strong>Se não responder:</strong> mova para "Perdido: sem retorno".</p>`,3);

card(c2,"FOLLOW-UP","label-followup","📅 FU com Data Marcada","Quando ela deu data específica",`<span class="tag-when">Na data exata que a paciente indicou</span><h3>"Só recebo dia 24"</h3><div class="msg-box good">Oi, [Nome]! Você mencionou que queria agendar nessa época. A doutora tem horário na próxima semana. Funciona?</div><h3>"Volto de viagem dia 10"</h3><div class="msg-box good">Oi, [Nome]! Bem-vinda de volta! 😊 Quando conversamos, você mencionou interesse no diagnóstico. Quer que eu reserve?</div>`,4);

// ═══════ COL 3 ═══════
const c3 = col("Quebrar Objeções", "🚫", 2);
card(c3,"OBJEÇÃO","label-objecao","➡️ \"Ela é dermatologista?\"","Objeção de credencial",`<span class="tag-obj">Objeção de credencial — a mais comum</span><div class="msg-box good">A Dra. Natália é biomédica esteta com 14 anos de experiência e 3 formações acadêmicas — incluindo Odontologia em curso. Ela desenvolveu um método proprietário. A experiência de 14 anos conta mais que o rótulo. Te envio as especializações.</div><p><strong>Contexto:</strong> Existe áudio de paciente relatando experiência ruim com dermato. Credencial não garante qualidade.</p>`,0);

card(c3,"OBJEÇÃO","label-objecao","➡️ \"Vai ficar artificial?\"","Medo de resultado não natural",`<span class="tag-obj">Objeção emocional — medo</span><div class="msg-box good">Entendo perfeitamente. É por isso que a doutora trabalha com o Protocolo Revera: antes de qualquer procedimento, ela mapeia o que restaurar, manter e nunca tocar. O objetivo é preservar a sua naturalidade.</div><div class="msg-box good">A proposta da doutora é o oposto de harmonização. Ela não cria um rosto novo. Restaura o seu.</div>`,1);

card(c3,"OBJEÇÃO","label-objecao","➡️ \"Quanto custa o pacote?\"","Mentalidade de clínica de volume",`<span class="tag-obj">Objeção de modelo mental</span><div class="msg-box good">Como o trabalho é ultra personalizado, a doutora analisa caso a caso. Não trabalhamos com pacotes prontos. Temos procedimentos que partem de R$ 1.500. Mas o primeiro passo é o diagnóstico.</div>`,2);

card(c3,"OBJEÇÃO","label-objecao","➡️ \"É muito caro\" / \"Preciso pensar\"","Sensibilidade a preço",`<span class="tag-obj">Objeção financeira</span><div class="msg-box good">Sem problema! A consulta para entrega do diagnóstico é R$ 400. Você sai com o mapeamento completo — e decide com calma. É um investimento no diagnóstico, não no procedimento.</div>`,3);

card(c3,"OBJEÇÃO","label-objecao","➡️ \"Já fiz e não gostei\"","Experiência ruim anterior",`<span class="tag-obj">Objeção de confiança</span><div class="msg-box good">É exatamente por isso que a doutora criou o Protocolo Revera. Ela faz diagnóstico estrutural antes de tocar no rosto — para não repetir o que deu errado. O foco é restaurar, não transformar.</div>`,4);

card(c3,"OBJEÇÃO","label-objecao","➡️ \"Vou pensar e te aviso\"","Hesitação",`<span class="tag-obj">Objeção de tempo</span><div class="msg-box good">Perfeito! Fico por aqui se precisar. A agenda da doutora é limitada, então quando decidir, me avise que garanto o melhor horário.</div><p>Agende FU suave em 3 dias.</p>`,5);

card(c3,"OBJEÇÃO","label-objecao","➡️ \"Só recebo dia X\"","Qualificação rápida",`<span class="tag-obj">Sinal de desqualificação</span><p>Nosso público tem cartão e limite. Se não tem R$ 400 para consulta, não é perfil.</p><div class="msg-box good">Sem problema! Quando estiver em um momento melhor, me avisa que verifico a disponibilidade.</div><p>Mova para "Perdido: preço".</p>`,6);

card(c3,"OBJEÇÃO","label-objecao","➡️ \"Mora longe\"","Distância como barreira",`<span class="tag-obj">Objeção de logística</span><div class="msg-box good">A clínica fica em Higienópolis — próximo à Av. Angélica. Muitas pacientes vêm dos Jardins, Itaim e Pinheiros. A consulta dura cerca de 1h.</div><p>Se mora em zona leste/Guarulhos: provavelmente não é perfil.</p>`,7);

// ═══════ COL 4 ═══════
const c4 = col("Fechamento", "⚜️", 3);
card(c4,"FECHAMENTO","label-fechamento","⚜️ Paciente decidida","Quando ela já quer agendar",`<h3>Cenário</h3><p>"Quero agendar consulta com a doutora."</p><p><strong>NÃO complique.</strong> Agende.</p><div class="msg-box good">Oi, [Nome]! Perfeito! A consulta de diagnóstico é R$ 400 e dura cerca de 1h. Temos disponibilidade essa semana. Qual o melhor horário?</div>`,0);

card(c4,"FECHAMENTO","label-fechamento","⚜️ Muda após o preço","Silêncio depois de ouvir R$ 400",`<h3>No mesmo dia (2–3h depois)</h3><div class="msg-box good">Ficou com alguma dúvida, [Nome]? Estou aqui. 😊</div><h3>No dia seguinte</h3><div class="msg-box good">[Nome], a doutora tem horário essa semana para a entrega do diagnóstico. Me avisa se tiver interesse!</div><p>Se não responder: "Perdido: preço".</p>`,1);

card(c4,"FECHAMENTO","label-fechamento","⚜️ Técnica: \"Entrega de Diagnóstico\"","A palavra que muda a conversão",`<h3>Antes (genérico)</h3><div class="msg-box bad">Gostaria de agendar uma avaliação com a doutora?</div><h3>Depois (estratégico)</h3><div class="msg-box good">A próxima etapa é a entrega do seu diagnóstico. Qual o melhor horário?</div><h3>Por que funciona</h3><ul><li>"Entrega" = ela vai receber algo concreto.</li><li>"Diagnóstico" = técnico, sério, profissional.</li><li>"Próxima etapa" = comando, não pedido.</li><li>"Horário" = chamada para ação imediata.</li></ul>`,2);

// ═══════ COL 5 ═══════
const c5 = col("Anti-Vácuo", "❌", 4);
card(c5,"ANTI-VÁCUO","label-antivacuo","💰 Sumiu no início","Respondeu a dor e sumiu",`<span class="tag-when">24h após sumir</span><div class="msg-box good">[Nome], vi que você mencionou [dor]. A Dra. Natália atende muitos casos assim. Te envio um conteúdo sobre o tema. [link]</div><p>Se não responder em 48h: "Perdido: deixou de responder".</p>`,0);

card(c5,"ANTI-VÁCUO","label-antivacuo","💰 Sumiu após informações","Ouviu autoridade/método e sumiu",`<span class="tag-when">48h após enviar informações</span><div class="msg-box good">[Nome], esse resultado da doutora foi em 4 dias. Achei que combinava. [link]</div><p>Não cobre. Envie valor.</p>`,1);

card(c5,"ANTI-VÁCUO","label-antivacuo","💰 Sumiu após R$ 400","Ouviu preço e desapareceu",`<span class="tag-when">24h após preço</span><div class="msg-box good">Ficou com alguma dúvida, [Nome]? 😊</div><p>Se não responder no dia seguinte:</p><div class="msg-box good">[Nome], a doutora tem horário essa semana. Me avisa!</div><p>Se não responder: descarte.</p>`,2);

card(c5,"ANTI-VÁCUO","label-antivacuo","🚫 Frases Proibidas","O que NUNCA dizer",`<h3>❌ Evitar sempre</h3><div class="msg-box bad">"Você ainda tem interesse?"</div><div class="msg-box bad">"Consigo manter seu contato?"</div><div class="msg-box bad">"Posso te ajudar em alguma coisa?"</div><div class="msg-box bad">"Qualquer dúvida estou à disposição."</div><h3>✅ Usar em vez disso</h3><div class="msg-box good">"Vi um caso que lembrei de você."</div><div class="msg-box good">"Esse resultado foi em 4 dias."</div><div class="msg-box good">"A agenda da doutora é limitada."</div>`,3);

// ═══════ COL 6 ═══════
const c6 = col("Reativação", "🔙", 5);
card(c6,"REATIVAÇÃO","label-reativacao","🔙 Reativação 01","15–20 dias · Reconexão",`<div class="msg-box good">Oi, [Nome]! Estava revendo conversas e lembrei do nosso papo sobre [dor]. A doutora publicou um conteúdo novo que achei que combinava. [link]</div>`,0);
card(c6,"REATIVAÇÃO","label-reativacao","🔙 Reativação 02","30 dias · Novidade",`<div class="msg-box good">Oi, [Nome]! A Dra. Natália começou a trabalhar com análise facial biométrica que mede rejuvenescimento em anos. Lembrei de você!</div>`,1);
card(c6,"REATIVAÇÃO","label-reativacao","🔙 Reativação 03","45 dias · Case impactante",`<div class="msg-box good">[Nome], uma paciente da doutora fez o protocolo e a família só percebeu quando viu a foto antiga. Se quiser conversar sobre o seu caso, estou aqui.</div>`,2);
card(c6,"REATIVAÇÃO","label-reativacao","🔙 Reativação 04","60 dias · Última tentativa",`<div class="msg-box good">[Nome], a doutora abriu a agenda de [mês]. Vagas limitadas. Se tiver interesse, me avisa que garanto um horário.</div><p>Se não responder: encerre o ciclo.</p>`,3);

// ═══════ COL 7 ═══════
const c7 = col("Fluxos e Regras", "📋", 6);
card(c7,"FLUXO","label-fluxo","✅ Qualificação Rápida","É perfil ou não?",`<h3>✅ É perfil</h3><ul><li>Mora em Higienópolis, Jardins, Itaim, Pinheiros.</li><li>Respondeu rápido, sabe o que quer.</li><li>Já fez procedimento antes.</li><li>Paga sem questionar.</li></ul><h3>❌ Não é perfil</h3><ul><li>"Só recebo dia X" — sem R$ 400 = sem perfil.</li><li>Pede pacote com preço fixo.</li><li>Mora longe e não quer se deslocar.</li><li>Nunca respondeu nada.</li></ul>`,0);

card(c7,"FLUXO","label-fluxo","✅ Vocabulário","Usar vs. Evitar",`<h3>✅ USAR</h3><ul><li><strong>Entrega de diagnóstico</strong> (não "avaliação")</li><li><strong>Restauração</strong> (não "harmonização")</li><li><strong>Protocolo Revera</strong> (não "pacote")</li><li><strong>Personalizado</strong> (não "universal")</li><li><strong>Investimento</strong> (não "preço")</li><li><strong>Próxima etapa</strong> (não "você quer?")</li><li><strong>Olhar cansado</strong> (resume tudo em 2 palavras)</li></ul><h3>❌ EVITAR</h3><ul><li>Harmonização, Pacote, Promoção, Desconto</li><li>"Qualquer dúvida estou à disposição"</li><li>"Você ainda tem interesse?"</li><li>Áudios longos</li></ul>`,1);

card(c7,"FLUXO","label-fluxo","✅ Técnica de Escrita","Mensagens curtas, palavra-chave no final",`<h3>Regra 1: Divida em mensagens separadas</h3><p>Nunca textão. Cada mensagem = 1 propósito.</p><h3>Regra 2: Palavra-chave no final</h3><div class="msg-box bad">A avaliação com a doutora é muito importante. Gostaria de agendar?</div><div class="msg-box good">A próxima etapa é a entrega do seu diagnóstico. Qual o melhor horário?</div><h3>Regra 3: Palavras-peso</h3><ul><li><strong>"Olhar cansado"</strong> = 2 palavras que resumem tudo.</li><li><strong>"Entrega de diagnóstico"</strong> = receber algo concreto.</li><li><strong>"14 anos"</strong> = números > adjetivos.</li><li><strong>"Restaurar, manter e nunca tocar"</strong> = frase proprietária.</li></ul>`,2);

card(c7,"FLUXO","label-fluxo","✅ Organização do Kommo","Colunas e motivos de perda",`<h3>Colunas do funil</h3><ul><li><strong>Novo lead</strong> — Enviar 1ª msg em < 5 min.</li><li><strong>Em conversa</strong> — Interagindo.</li><li><strong>Aguardando resposta</strong> — Recebeu preço.</li><li><strong>Agendado</strong> — Confirmar 24h antes.</li><li><strong>Nutrição</strong> — Interesse mas não agora.</li></ul><h3>Motivos de perda</h3><ul><li>Distância / Preço / Insegurança / Sem retorno / Deixou de responder / Não quer / Spam</li></ul><p>⚠️ Elimine colunas antigas: "Sem dinheiro", "Mora longe", "Reativação", "R$ 300 off".</p>`,3);

card(c7,"FLUXO","label-fluxo","📊 Relatório Semanal","O que reportar",`<h3>Métricas semanais</h3><ul><li>Total de leads novos</li><li>Taxa de resposta (responderam ÷ total)</li><li>Consultas agendadas</li><li>Consultas realizadas</li><li>Top 3 motivos de perda</li><li>Objeções mais comuns (alimenta conteúdo)</li></ul><p>Planilha simples no Drive, atualizada toda semana.</p>`,4);

}); // end transaction

tx();
console.log("\n  ✅ Banco de dados criado e populado com sucesso!");
console.log(`  📁 ${DB_PATH}`);
const colCount = db.prepare("SELECT COUNT(*) as c FROM columns").get().c;
const cardCount = db.prepare("SELECT COUNT(*) as c FROM cards").get().c;
console.log(`  📊 ${colCount} colunas, ${cardCount} cards\n`);
db.close();
