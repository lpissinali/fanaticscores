/* ============================================================
   Fanatic Scores — Mock data
   Ported from design_handoff_fanatic_scores/app/data.js
   Replace with real adapter calls (src/adapters/*) in production.
   ============================================================ */

import type { FSData } from './types';

export const mockData: FSData = {
  featuredMatch: {
    id: 'm1',
    competition: 'UEFA Champions League · QF 2nd leg',
    compCountry: 'Europe',
    status: 'LIVE',
    minute: 67,
    home: { name: 'Manchester City', short: 'MCI', score: 2, color: '#6CABDD', initial: 'M' },
    away: { name: 'Real Madrid',     short: 'RMA', score: 2, color: '#FEBE10', initial: 'R' },
    aggregate: '4–4 on aggregate',
    stats: {
      possession:    [54, 46],
      shots:         [12, 9],
      shotsOnTarget: [5, 4],
      xG:            [1.8, 1.6],
      corners:       [6, 3],
    },
    events: [
      { min: '12', type: 'goal',   team: 'home', player: 'Haaland',     detail: 'Right foot, assist De Bruyne' },
      { min: '28', type: 'yellow', team: 'away', player: 'Rüdiger' },
      { min: '34', type: 'goal',   team: 'away', player: 'Vinícius Jr', detail: 'Left foot, counter-attack' },
      { min: '49', type: 'goal',   team: 'away', player: 'Bellingham',  detail: 'Header, corner kick' },
      { min: '63', type: 'goal',   team: 'home', player: 'Foden',       detail: 'Curler, top-corner' },
    ],
    aiPulse:
      "City just answered. Foden's curler swings momentum back — pressure is up 31% since the equaliser and Real haven't crossed midfield in 4 minutes.",
    momentumSeries: [
      40, 42, 48, 55, 52, 48, 38, 30, 28, 35,
      50, 62, 68, 72, 70, 65, 58, 54, 60, 72,
      80, 76, 70, 68, 72, 78, 82,
    ],
  },

  competitions: [
    {
      id: 'ucl',
      name: 'UEFA Champions League',
      country: 'Europe',
      short: 'UCL',
      stage: 'Quarter-finals · 2nd leg',
      flag: '#0033A0',
      matches: [
        {
          id: 'm1',
          status: 'LIVE', minute: '67',
          featured: true,
          home: { name: 'Manchester City', short: 'MCI', score: 2, color: '#6CABDD', initial: 'M' },
          away: { name: 'Real Madrid',     short: 'RMA', score: 2, color: '#FEBE10', initial: 'R' },
          aggregate: '4–4 agg.',
        },
        {
          id: 'm2',
          status: 'LIVE', minute: '41',
          home: { name: 'Bayern München', short: 'BAY', score: 1, color: '#DC052D', initial: 'B' },
          away: { name: 'Arsenal',        short: 'ARS', score: 0, color: '#EF0107', initial: 'A' },
          aggregate: '3–2 agg.',
        },
      ],
    },
    {
      id: 'pl',
      name: 'Premier League',
      country: 'England',
      short: 'EPL',
      flag: '#FFFFFF',
      matches: [
        {
          id: 'm3',
          status: 'LIVE', minute: '78',
          home: { name: 'Liverpool', short: 'LIV', score: 3, color: '#C8102E', initial: 'L' },
          away: { name: 'Chelsea',   short: 'CHE', score: 1, color: '#034694', initial: 'C' },
        },
        {
          id: 'm4',
          status: 'HT',
          home: { name: 'Tottenham',   short: 'TOT', score: 0, color: '#FFFFFF', initial: 'T' },
          away: { name: 'Aston Villa', short: 'AVL', score: 0, color: '#670E36', initial: 'A' },
        },
        {
          id: 'm5',
          status: 'FT',
          home: { name: 'Newcastle', short: 'NEW', score: 2, color: '#241F20', initial: 'N' },
          away: { name: 'Brighton',  short: 'BHA', score: 1, color: '#0057B8', initial: 'B' },
        },
        {
          id: 'm6',
          status: 'SCHEDULED', kickoff: '21:00',
          home: { name: 'West Ham',      short: 'WHU', score: null, color: '#7A263A', initial: 'W' },
          away: { name: 'Crystal Palace',short: 'CRY', score: null, color: '#1B458F', initial: 'C' },
        },
      ],
    },
    {
      id: 'laliga',
      name: 'LaLiga',
      country: 'Spain',
      short: 'LAL',
      flag: '#AA151B',
      matches: [
        {
          id: 'm7',
          status: 'LIVE', minute: "22",
          home: { name: 'Barcelona',       short: 'BAR', score: 1, color: '#A50044', initial: 'B' },
          away: { name: 'Atlético Madrid', short: 'ATM', score: 1, color: '#CE3524', initial: 'A' },
        },
        {
          id: 'm8',
          status: 'SCHEDULED', kickoff: '22:00',
          home: { name: 'Sevilla',        short: 'SEV', score: null, color: '#D80024', initial: 'S' },
          away: { name: 'Real Sociedad',  short: 'RSO', score: null, color: '#0067B1', initial: 'R' },
        },
      ],
    },
    {
      id: 'brasileirao',
      name: 'Brasileirão',
      country: 'Brazil',
      short: 'BRA',
      flag: '#009C3B',
      matches: [
        {
          id: 'm9',
          status: 'LIVE', minute: '54',
          home: { name: 'Palmeiras', short: 'PAL', score: 0, color: '#006437', initial: 'P' },
          away: { name: 'Flamengo',  short: 'FLA', score: 1, color: '#C8102E', initial: 'F' },
        },
        {
          id: 'm10',
          status: 'SCHEDULED', kickoff: '23:30',
          home: { name: 'Botafogo',    short: 'BOT', score: null, color: '#000000', initial: 'B' },
          away: { name: 'Corinthians', short: 'COR', score: null, color: '#FFFFFF', initial: 'C' },
        },
      ],
    },
    {
      id: 'seriea',
      name: 'Serie A',
      country: 'Italy',
      short: 'SEA',
      flag: '#009246',
      matches: [
        {
          id: 'm11',
          status: 'FT',
          home: { name: 'Inter',  short: 'INT', score: 2, color: '#0068A8', initial: 'I' },
          away: { name: 'Napoli', short: 'NAP', score: 2, color: '#1C9DDB', initial: 'N' },
        },
      ],
    },
  ],

  trending: [
    { id: 't1', tag: 'GOAL',   text: "Foden equalises for City in the 63rd minute — curler into the top corner" },
    { id: 't2', tag: 'RED',    text: "Possible red card incident in Barça vs Atlético — VAR reviewing" },
    { id: 't3', tag: 'MOMENT', text: "Vinícius Jr solo run from halfway — already the clip of the night" },
    { id: 't4', tag: 'RESULT', text: "Inter held by Napoli 2–2 — title race wide open again" },
  ],
};
