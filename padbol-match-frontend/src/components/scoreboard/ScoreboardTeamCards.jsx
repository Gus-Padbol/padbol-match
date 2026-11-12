import React from 'react';
import {resolveTeamColors,teamButtonStyle} from '../../utils/scoreboardTeamColors';
import {TeamNameRow,TeamPlayersBlock,gameScoreClassName,formatGameScore} from '../../pages/ScoreboardControl';

export default function ScoreboardTeamCards({partido,disabled,onPoint}) {
 const display=partido.display||{};
 const {colorA,colorB}=resolveTeamColors(partido);
 return (
      <div className="sc-columns">
        <div className="sc-team-card sc-team-card--a">
          <div className="sc-team-card__header">
            <TeamNameRow name={partido.equipo_a_nombre} serving={partido.saque_actual === 'A'} />
            <TeamPlayersBlock jugadores={partido.equipo_a_jugadores} />
          </div>
          <div className="sc-team-card__score-block">
            <div className={gameScoreClassName(display, 'A')}>
              {formatGameScore(display, 'A')}
            </div>
            <div className="sc-stats">
              <div>
                <strong>{partido.games_a}</strong>
                Games
              </div>
              <div>
                <strong>{partido.sets_a}</strong>
                Sets
              </div>
            </div>
            <button
              type="button"
              className="sc-point-btn sc-point-btn--a"
              style={teamButtonStyle(colorA)}
              disabled={disabled}
              onClick={() => onPoint('A')}
            >
              + POINT
            </button>
          </div>
        </div>

        <div className="sc-team-card sc-team-card--b">
          <div className="sc-team-card__header">
            <TeamNameRow name={partido.equipo_b_nombre} serving={partido.saque_actual === 'B'} />
            <TeamPlayersBlock jugadores={partido.equipo_b_jugadores} />
          </div>
          <div className="sc-team-card__score-block">
            <div className={gameScoreClassName(display, 'B')}>
              {formatGameScore(display, 'B')}
            </div>
            <div className="sc-stats">
              <div>
                <strong>{partido.games_b}</strong>
                Games
              </div>
              <div>
                <strong>{partido.sets_b}</strong>
                Sets
              </div>
            </div>
            <button
              type="button"
              className="sc-point-btn sc-point-btn--b"
              style={teamButtonStyle(colorB)}
              disabled={disabled}
              onClick={() => onPoint('B')}
            >
              + POINT
            </button>
          </div>
        </div>
      </div>

 );
}
