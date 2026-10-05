export { AuraCanvas as BackgroundCanvas } from '../canvas/AuraCanvas';
export default function BackgroundCanvasWrapper(props: any) {
  const { AuraCanvas } = require('../canvas/AuraCanvas');
  return <AuraCanvas {...props} />;
}
