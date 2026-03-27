const PRESETS = [
  {
    id: 'general',
    label: 'General',
    domain: 'llm',
    description: 'Balanced across all dimensions for general-purpose use.',
    factor_weights: {
      reasoning: 25, factuality: 20, safety: 15, coding: 15,
      agentic: 5, instruction: 10, efficiency: 5, bias: 2, context: 2, multimodal: 1,
    },
  },
  {
    id: 'code_agent',
    label: 'Code Agent',
    domain: 'llm',
    description: 'Optimised for software engineering, coding, and tool-use pipelines.',
    factor_weights: {
      reasoning: 20, factuality: 10, safety: 8, coding: 35,
      agentic: 10, instruction: 15, efficiency: 2, bias: 0, context: 0, multimodal: 0,
    },
  },
  {
    id: 'research',
    label: 'Research',
    domain: 'llm',
    description: 'Prioritises factual accuracy, reasoning depth, and long-context handling.',
    factor_weights: {
      reasoning: 30, factuality: 25, safety: 8, coding: 10,
      agentic: 5, instruction: 7, efficiency: 3, bias: 2, context: 8, multimodal: 2,
    },
  },
  {
    id: 'medical_legal',
    label: 'Medical / Legal',
    domain: 'llm',
    description: 'High weight on safety, bias fairness, and factual precision for regulated environments.',
    factor_weights: {
      reasoning: 15, factuality: 20, safety: 40, coding: 0,
      agentic: 5, instruction: 5, efficiency: 2, bias: 10, context: 2, multimodal: 1,
    },
  },
  {
    id: 'customer_support',
    label: 'Customer Support',
    domain: 'llm',
    description: 'Optimised for instruction following, safety, and agentic task completion.',
    factor_weights: {
      reasoning: 15, factuality: 20, safety: 20, coding: 5,
      agentic: 15, instruction: 20, efficiency: 5, bias: 0, context: 0, multimodal: 0,
    },
  },

  // Robotics presets
  {
    id: 'robo_general',
    label: 'General Robotics',
    domain: 'robotics',
    description: 'Balanced evaluation of manipulation, planning, and generalization.',
    factor_weights: {
      task_success: 25, generalization: 20, manipulation: 20,
      planning: 15, robo_efficiency: 10, robo_safety: 10,
    },
  },
  {
    id: 'robo_manufacturing',
    label: 'Manufacturing',
    domain: 'robotics',
    description: 'Optimised for repetitive manipulation tasks with high precision and safety.',
    factor_weights: {
      task_success: 20, generalization: 5, manipulation: 30,
      planning: 10, robo_efficiency: 15, robo_safety: 20,
    },
  },
  {
    id: 'robo_research',
    label: 'Research Platform',
    domain: 'robotics',
    description: 'Prioritises generalization and sim-to-real transfer for research applications.',
    factor_weights: {
      task_success: 15, generalization: 35, manipulation: 15,
      planning: 20, robo_efficiency: 10, robo_safety: 5,
    },
  },

  // Weather presets
  {
    id: 'weather_general',
    label: 'General Forecasting',
    domain: 'weather',
    description: 'Balanced evaluation of accuracy, lead time, and extreme event prediction.',
    factor_weights: {
      forecast_accuracy: 30, lead_time: 20, extreme_events: 15,
      probabilistic_skill: 15, resolution: 10, weather_efficiency: 10,
    },
  },
  {
    id: 'weather_operations',
    label: 'Operational NWP',
    domain: 'weather',
    description: 'Prioritises accuracy and computational efficiency for operational deployment.',
    factor_weights: {
      forecast_accuracy: 25, lead_time: 15, extreme_events: 10,
      probabilistic_skill: 10, resolution: 15, weather_efficiency: 25,
    },
  },
  {
    id: 'weather_extremes',
    label: 'Extreme Events',
    domain: 'weather',
    description: 'Focused on tropical cyclone, heatwave, and extreme precipitation prediction.',
    factor_weights: {
      forecast_accuracy: 15, lead_time: 15, extreme_events: 35,
      probabilistic_skill: 20, resolution: 10, weather_efficiency: 5,
    },
  },

  // Materials presets
  {
    id: 'mat_general',
    label: 'General Materials',
    domain: 'materials',
    description: 'Balanced evaluation of property prediction, stability, and generalization.',
    factor_weights: {
      property_prediction: 30, stability_discovery: 25, mat_generalization: 20,
      structure_quality: 15, mat_efficiency: 10,
    },
  },
  {
    id: 'mat_discovery',
    label: 'Materials Discovery',
    domain: 'materials',
    description: 'Optimised for discovering new stable materials with high-throughput screening.',
    factor_weights: {
      property_prediction: 15, stability_discovery: 35, mat_generalization: 15,
      structure_quality: 25, mat_efficiency: 10,
    },
  },
  {
    id: 'mat_screening',
    label: 'High-Throughput Screening',
    domain: 'materials',
    description: 'Prioritises accuracy and computational cost for large-scale screening pipelines.',
    factor_weights: {
      property_prediction: 35, stability_discovery: 20, mat_generalization: 15,
      structure_quality: 5, mat_efficiency: 25,
    },
  },
];

const PRESET_MAP = Object.fromEntries(PRESETS.map(p => [p.id, p]));

window.Presets = { PRESETS };
