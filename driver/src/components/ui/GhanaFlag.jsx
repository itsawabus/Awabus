import Svg, { Polygon, Rect } from 'react-native-svg';

// Flag of Ghana: red, gold and green horizontal stripes with a black
// five-pointed star in the centre (3:2 ratio).
export default function GhanaFlag({ width = 24, height = 16 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 30 20" accessibilityLabel="Ghana flag">
      <Rect width="30" height="6.67" fill="#CE1126" />
      <Rect y="6.67" width="30" height="6.67" fill="#FCD116" />
      <Rect y="13.33" width="30" height="6.67" fill="#006B3F" />
      <Polygon points="15,6.7 15.74,8.98 18.14,8.98 16.2,10.39 16.94,12.67 15,11.26 13.06,12.67 13.8,10.39 11.86,8.98 14.26,8.98" fill="#000" />
    </Svg>
  );
}
