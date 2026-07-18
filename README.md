# Atero Calendar

Aplicativo de calendário do ecossistema Atero, publicado em `calendar.atero.space`.

## Arquitetura

```text
index.html
  └─ js/bootstrap.js
       ├─ js/access-guard.js
       └─ js/app.js
            ├─ js/state.js
            ├─ js/date-utils.js
            ├─ js/api.js
            ├─ js/events.js
            ├─ js/calendar.js
            ├─ js/modal.js
            └─ js/navigation.js
```

### Responsabilidades

- `bootstrap.js`: valida o acesso e inicia o aplicativo.
- `access-guard.js`: integra a sessão da Conta Atero e consulta `/access/calendar`.
- `app.js`: coordena os módulos e o ciclo de renderização.
- `state.js`: mantém o estado compartilhado do frontend.
- `date-utils.js`: concentra cálculos e formatações de datas.
- `api.js`: conversa com a Atero API e oferece armazenamento local temporário.
- `events.js`: valida e manipula eventos.
- `calendar.js`: renderiza as visualizações de mês, semana e dia.
- `modal.js`: cria, edita e exclui eventos.
- `navigation.js`: controla datas, visualizações, busca, filtros e atalhos.

## API esperada

O frontend está preparado para os seguintes endpoints:

```text
GET    /calendar/events?start=<ISO>&end=<ISO>
POST   /calendar/events
PATCH  /calendar/events/{id}
DELETE /calendar/events/{id}
```

Enquanto esses endpoints ainda não estiverem disponíveis, o `api.js` usa `localStorage` automaticamente. O armazenamento é separado por usuário da Conta Atero.

## Formato de evento

```json
{
  "id": "uuid",
  "calendar_id": "default",
  "title": "Reunião",
  "description": "",
  "location": "",
  "starts_at": "2026-07-18T15:00:00.000Z",
  "ends_at": "2026-07-18T16:00:00.000Z",
  "all_day": false,
  "color": "#5b5bd6"
}
```

## Atalhos

- `N`: novo evento
- `T`: hoje
- `M`: visualização mensal
- `W`: visualização semanal
- `D`: visualização diária
- `←` e `→`: período anterior ou seguinte
