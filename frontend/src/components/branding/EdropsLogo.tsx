import React from 'react';
import logoFullBlue from '../../assets/logo-full-blue.svg';
import logoFullWhite from '../../assets/logo-full-white.svg';
import logoIconBlue from '../../assets/logo-icon-blue.svg';
import logoIconWhite from '../../assets/logo-icon-white.svg';
import logoAppIcon from '../../assets/logo-pwa.png';

export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: 'blue' | 'white' | 'auto' | 'app-icon' | 'icon' | 'full';
  color?: 'blue' | 'white' | 'currentColor';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  alt?: string;
}

export const BRAND_BLUE = '#00AEEF';

export const EdropsLogo: React.FC<LogoProps> = ({
  variant = 'blue',
  color,
  size = 'md',
  className = '',
  alt = 'E Drops',
  style,
  ...props
}) => {
  let assetSrc = logoFullBlue;
  const isSquare = variant === 'icon' || variant === 'app-icon';

  if (variant === 'app-icon') {
    assetSrc = logoAppIcon;
  } else if (variant === 'icon') {
    assetSrc = color === 'white' ? logoIconWhite : logoIconBlue;
  } else if (variant === 'white' || color === 'white') {
    assetSrc = logoFullWhite;
  } else {
    // 'blue' | 'full' | 'auto' -> default to official blue full wordmark
    assetSrc = logoFullBlue;
  }

  const getSizeClasses = () => {
    // If specific height/width already provided in className, don't force conflict
    if (className.includes('h-') || className.includes('w-')) {
      return '';
    }

    if (typeof size === 'number') {
      return '';
    }

    if (isSquare) {
      switch (size) {
        case 'xs':
          return 'h-4 w-4';
        case 'sm':
          return 'h-6 w-6';
        case 'md':
          return 'h-8 w-8';
        case 'lg':
          return 'h-10 w-10';
        case 'xl':
          return 'h-14 w-14';
        default:
          return 'h-8 w-8';
      }
    }

    switch (size) {
      case 'xs':
        return 'h-4 w-auto';
      case 'sm':
        return 'h-6 w-auto';
      case 'md':
        return 'h-8 w-auto';
      case 'lg':
        return 'h-10 w-auto';
      case 'xl':
        return 'h-14 w-auto';
      default:
        return 'h-8 w-auto';
    }
  };

  const styleProps: React.CSSProperties = {
    ...style,
    ...(typeof size === 'number'
      ? {
          height: `${size}px`,
          width: isSquare ? `${size}px` : 'auto',
        }
      : {}),
  };

  return (
    <img
      src={assetSrc}
      alt={alt}
      className={`object-contain select-none pointer-events-none ${getSizeClasses()} ${className}`.trim()}
      style={styleProps}
      draggable={false}
      {...props}
    />
  );
};

export default EdropsLogo;
