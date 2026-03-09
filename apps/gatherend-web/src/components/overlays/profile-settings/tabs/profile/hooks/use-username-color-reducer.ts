"use client";

import { useReducer, useCallback, useMemo } from "react";
import { DEFAULT_USERNAME_COLOR } from "@/lib/theme/presets";
import type { GradientColorStop } from "@/components/ui/gradient-slider";
import type { UsernameColor } from "../types";

// State Shape

export interface UsernameColorState {
  mode: "solid" | "gradient";
  solidColor: string;
  gradientColors: GradientColorStop[];
  gradientAngle: number;
  gradientAnimated: boolean;
  animationType: "shift" | "shimmer" | "pulse";
  selectedGradientIndex: number | null;
}

// Actions

type UsernameColorAction =
  | { type: "SET_MODE"; payload: "solid" | "gradient" }
  | { type: "SET_SOLID_COLOR"; payload: string }
  | { type: "SET_GRADIENT_COLORS"; payload: GradientColorStop[] }
  | { type: "SET_GRADIENT_ANGLE"; payload: number }
  | { type: "SET_GRADIENT_ANIMATED"; payload: boolean }
  | { type: "SET_ANIMATION_TYPE"; payload: "shift" | "shimmer" | "pulse" }
  | { type: "SET_SELECTED_INDEX"; payload: number | null }
  | { type: "UPDATE_SELECTED_COLOR"; payload: string }
  | { type: "REMOVE_SELECTED_COLOR" }
  | { type: "RESET"; payload: UsernameColorState };

// Reducer

function usernameColorReducer(
  state: UsernameColorState,
  action: UsernameColorAction,
): UsernameColorState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload };

    case "SET_SOLID_COLOR":
      return { ...state, solidColor: action.payload };

    case "SET_GRADIENT_COLORS":
      return { ...state, gradientColors: action.payload };

    case "SET_GRADIENT_ANGLE":
      return { ...state, gradientAngle: action.payload };

    case "SET_GRADIENT_ANIMATED":
      return { ...state, gradientAnimated: action.payload };

    case "SET_ANIMATION_TYPE":
      return { ...state, animationType: action.payload };

    case "SET_SELECTED_INDEX":
      return { ...state, selectedGradientIndex: action.payload };

    case "UPDATE_SELECTED_COLOR":
      if (state.selectedGradientIndex === null) return state;
      return {
        ...state,
        gradientColors: state.gradientColors.map((c, i) =>
          i === state.selectedGradientIndex
            ? { ...c, color: action.payload }
            : c,
        ),
      };

    case "REMOVE_SELECTED_COLOR":
      if (
        state.selectedGradientIndex === null ||
        state.gradientColors.length <= 2
      )
        return state;
      return {
        ...state,
        gradientColors: state.gradientColors.filter(
          (_, i) => i !== state.selectedGradientIndex,
        ),
        selectedGradientIndex: null,
      };

    case "RESET":
      return action.payload;

    default:
      return state;
  }
}

// Initial State Factory

function parseInitialColor(color: unknown): UsernameColorState {
  const defaultState: UsernameColorState = {
    mode: "solid",
    solidColor: DEFAULT_USERNAME_COLOR,
    gradientColors: [
      { color: "#FF5733", position: 0 },
      { color: "#33FF57", position: 100 },
    ],
    gradientAngle: 90,
    gradientAnimated: false,
    animationType: "shift",
    selectedGradientIndex: null,
  };

  if (!color) return defaultState;

  if (typeof color === "string") {
    return { ...defaultState, solidColor: color };
  }

  if (typeof color === "object" && color !== null) {
    const c = color as UsernameColor;
    if (c?.type === "solid") {
      return { ...defaultState, solidColor: c.color };
    }
    if (c?.type === "gradient") {
      return {
        ...defaultState,
        mode: "gradient",
        gradientColors: c.colors,
        gradientAngle: c.angle,
        gradientAnimated: c.animated || false,
        animationType: c.animationType || "shift",
      };
    }
  }

  return defaultState;
}

// Hook

export function useUsernameColorReducer(initialColor: unknown) {
  const initialState = useMemo(
    () => parseInitialColor(initialColor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // Only parse once on mount
  );

  const [state, dispatch] = useReducer(usernameColorReducer, initialState);

  // Memoized action dispatchers
  const actions = useMemo(
    () => ({
      setMode: (mode: "solid" | "gradient") =>
        dispatch({ type: "SET_MODE", payload: mode }),
      setSolidColor: (color: string) =>
        dispatch({ type: "SET_SOLID_COLOR", payload: color }),
      setGradientColors: (colors: GradientColorStop[]) =>
        dispatch({ type: "SET_GRADIENT_COLORS", payload: colors }),
      setGradientAngle: (angle: number) =>
        dispatch({ type: "SET_GRADIENT_ANGLE", payload: angle }),
      setGradientAnimated: (animated: boolean) =>
        dispatch({ type: "SET_GRADIENT_ANIMATED", payload: animated }),
      setAnimationType: (type: "shift" | "shimmer" | "pulse") =>
        dispatch({ type: "SET_ANIMATION_TYPE", payload: type }),
      setSelectedIndex: (index: number | null) =>
        dispatch({ type: "SET_SELECTED_INDEX", payload: index }),
      updateSelectedColor: (color: string) =>
        dispatch({ type: "UPDATE_SELECTED_COLOR", payload: color }),
      removeSelectedColor: () => dispatch({ type: "REMOVE_SELECTED_COLOR" }),
      reset: (state: UsernameColorState) =>
        dispatch({ type: "RESET", payload: state }),
    }),
    [],
  );

  // Build the final UsernameColor object for submission
  const buildColor = useCallback((): UsernameColor => {
    if (state.mode === "gradient") {
      return {
        type: "gradient",
        colors: state.gradientColors,
        angle: state.gradientAngle,
        animated: state.gradientAnimated,
        animationType: state.gradientAnimated ? state.animationType : undefined,
      };
    }
    return { type: "solid", color: state.solidColor };
  }, [state]);

  return { state, actions, buildColor };
}
