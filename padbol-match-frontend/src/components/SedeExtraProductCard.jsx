import React from 'react';
import './SedeExtraProductCard.css';

/**
 * Card de extra / producto del tercer tiempo (checkout reserva o armar partido).
 * Mobile: imagen 60×60, texto y cantidad a la derecha. Desktop (≥768px): layout amplio con foto 130px.
 */
export default function SedeExtraProductCard({
  nombre,
  descripcion,
  imagenUrl,
  priceLabel,
  qty,
  onDecrement,
  onIncrement,
}) {
  const imgUrl = String(imagenUrl || '').trim();
  const quantity = Math.min(10, Math.max(0, parseInt(String(qty), 10) || 0));

  return (
    <div className="sede-extra-product-card">
      <div className="sede-extra-product-card__image-wrap" aria-hidden={!imgUrl}>
        {imgUrl ? (
          <img src={imgUrl} alt="" />
        ) : (
          <span className="sede-extra-product-card__placeholder">📦</span>
        )}
      </div>
      <div className="sede-extra-product-card__body">
        <div className="sede-extra-product-card__info">
          <div className="sede-extra-product-card__name">{nombre}</div>
          {descripcion ? <div className="sede-extra-product-card__desc">{descripcion}</div> : null}
        </div>
        <div className="sede-extra-product-card__footer">
          <div className="sede-extra-product-card__price">{priceLabel}</div>
          <div className="sede-extra-product-card__qty">
            <button
              type="button"
              className="sede-extra-product-card__qty-btn"
              aria-label="Quitar una unidad"
              disabled={quantity <= 0}
              onClick={onDecrement}
            >
              −
            </button>
            <span className="sede-extra-product-card__qty-value">{quantity}</span>
            <button
              type="button"
              className="sede-extra-product-card__qty-btn"
              aria-label="Agregar una unidad"
              disabled={quantity >= 10}
              onClick={onIncrement}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
