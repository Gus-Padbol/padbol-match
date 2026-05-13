import React from 'react';
import { ReactComponent as CheckSvg } from '../../assets/icons/CHECK.svg';
import { ReactComponent as DarkThemeSvg } from '../../assets/icons/DARK_THEME.svg';
import { ReactComponent as WhiteThemeSvg } from '../../assets/icons/WHITE_THEME.svg';
import { ReactComponent as FiltrosSvg } from '../../assets/icons/FILTROS.svg';
import { ReactComponent as JugarSvg } from '../../assets/icons/JUGAR.svg';
import { ReactComponent as NotificacionesSvg } from '../../assets/icons/NOTIFICACIONES.svg';
import { ReactComponent as UbicacionSvg } from '../../assets/icons/UBICACION.svg';
import { ReactComponent as UserSvg } from '../../assets/icons/USER.svg';

const block = { display: 'block', flexShrink: 0 };

function wrap(Svg, displayName) {
  function Icon({ size = 24, width, height, className, style, title, ...rest }) {
    const w = width ?? size;
    const h = height ?? size;
    return (
      <Svg
        width={w}
        height={h}
        className={className}
        style={{ ...block, color: 'inherit', ...style }}
        role={title ? 'img' : 'presentation'}
        aria-hidden={title ? undefined : true}
        {...(title ? { 'aria-label': title } : {})}
        {...rest}
      />
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

/** Círculo + tilde; usar dentro de un contenedor con color definido (p. ej. blanco sobre verde). */
export const IconGeroCheck = wrap(CheckSvg, 'IconGeroCheck');

/** Modo oscuro (luna) — acción “pasar a oscuro”. */
export const IconGeroDarkTheme = wrap(DarkThemeSvg, 'IconGeroDarkTheme');

/** Modo claro (sol) — acción “pasar a claro”. */
export const IconGeroWhiteTheme = wrap(WhiteThemeSvg, 'IconGeroWhiteTheme');

export const IconGeroFiltros = wrap(FiltrosSvg, 'IconGeroFiltros');

export const IconGeroJugarNav = wrap(JugarSvg, 'IconGeroJugarNav');

export const IconGeroNotificacionesNav = wrap(NotificacionesSvg, 'IconGeroNotificacionesNav');

export const IconGeroUbicacion = wrap(UbicacionSvg, 'IconGeroUbicacion');

export const IconGeroUserNav = wrap(UserSvg, 'IconGeroUserNav');
