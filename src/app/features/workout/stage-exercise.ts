/** What the screen shows of one exercise: the picture, the name and the steps. */
export interface StageExercise {
  name: string;
  imageUrl: string | null;
  alt: string;
  initial: string;
  caption: string;
  steps: string[];
  frameCount: number;
  frame: number;
}
