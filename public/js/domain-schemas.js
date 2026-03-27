// public/js/domain-schemas.js
// Domain-specific factor schemas for non-LLM model categories.
// Each schema follows the same structure as FACTOR_SCHEMA in factors.js.

const DOMAIN_SCHEMAS = {};

DOMAIN_SCHEMAS.robotics = [
  {
    factor_id: 'task_success',
    label: 'Task Success',
    tag: 'performance',
    color: '#2f9e44',
    icon: 'check-circle',
    description: 'End-to-end success rate on manipulation and interaction tasks across standard benchmarks.',
    sub_metrics: [
      { sub_metric_id: 'single_task_success',    label: 'Single Task Success',     benchmark_name: 'LIBERO-Object', benchmark_url: 'https://github.com/Lifelong-Robot-Learning/LIBERO', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'multi_task_success',     label: 'Multi-Task Success',      benchmark_name: 'LIBERO-Goal',   benchmark_url: 'https://github.com/Lifelong-Robot-Learning/LIBERO', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'long_horizon_completion',label: 'Long-Horizon Completion', benchmark_name: 'LIBERO-Long',   benchmark_url: 'https://github.com/Lifelong-Robot-Learning/LIBERO', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'failure_recovery',       label: 'Failure Recovery Rate',   benchmark_name: 'RoboSuite',     benchmark_url: 'https://robosuite.ai/', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'generalization',
    label: 'Generalization',
    tag: 'adaptability',
    color: '#6741d9',
    icon: 'git-branch',
    description: 'Ability to transfer learned skills to new embodiments, objects, and environments.',
    sub_metrics: [
      { sub_metric_id: 'cross_embodiment',         label: 'Cross-Embodiment Transfer', benchmark_name: 'Open X-Embodiment', benchmark_url: 'https://robotics-transformer-x.github.io/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'novel_object_manipulation', label: 'Novel Object Handling',     benchmark_name: 'SimplerEnv',        benchmark_url: 'https://github.com/simpler-env/SimplerEnv', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'instruction_generalization',label: 'Instruction Generalization',benchmark_name: 'VLABench',          benchmark_url: 'https://github.com/OpenMOSS/VLABench', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'sim_to_real_transfer',     label: 'Sim-to-Real Transfer',      benchmark_name: 'SimplerEnv',        benchmark_url: 'https://github.com/simpler-env/SimplerEnv', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'manipulation',
    label: 'Manipulation Skill',
    tag: 'performance',
    color: '#f76707',
    icon: 'hand',
    description: 'Fine-grained motor control, grasping precision, and dexterous manipulation capability.',
    sub_metrics: [
      { sub_metric_id: 'grasp_precision',        label: 'Grasp Precision',        benchmark_name: 'DexGraspNet',  benchmark_url: 'https://pku-epic.github.io/DexGraspNet/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'dexterous_manipulation', label: 'Dexterous Manipulation', benchmark_name: 'DexArt',      benchmark_url: 'https://www.chenbao.tech/dexart/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'force_control',          label: 'Force Control',          benchmark_name: 'RoboSuite',   benchmark_url: 'https://robosuite.ai/', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'planning',
    label: 'Planning & Reasoning',
    tag: 'intelligence',
    color: '#1971c2',
    icon: 'route',
    description: 'Sequential task planning, spatial reasoning, and tool-use in complex scenarios.',
    sub_metrics: [
      { sub_metric_id: 'sequential_planning', label: 'Sequential Planning',   benchmark_name: 'VLABench',  benchmark_url: 'https://github.com/OpenMOSS/VLABench', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'spatial_reasoning',   label: 'Spatial Reasoning',     benchmark_name: 'RoboVerse', benchmark_url: 'https://github.com/RoboVerse/roboverse', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'tool_use_success',    label: 'Tool Use Success',      benchmark_name: 'RoboVerse', benchmark_url: 'https://github.com/RoboVerse/roboverse', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'robo_efficiency',
    label: 'Efficiency',
    tag: 'operations',
    color: '#5c7cfa',
    icon: 'gauge',
    description: 'Inference speed, parameter efficiency, and data efficiency for real-time control.',
    sub_metrics: [
      { sub_metric_id: 'inference_hz',           label: 'Inference Frequency (Hz)', benchmark_name: 'Hardware Benchmark', benchmark_url: '', invert: false, contamination_risk: 'na' },
      { sub_metric_id: 'parameter_count',        label: 'Parameters (M) (\u2193)',  benchmark_name: 'Model Spec',         benchmark_url: '', invert: true,  contamination_risk: 'na' },
      { sub_metric_id: 'training_data_hours',    label: 'Training Data (hrs)',       benchmark_name: 'Model Spec',         benchmark_url: '', invert: false, contamination_risk: 'na' },
    ],
  },
  {
    factor_id: 'robo_safety',
    label: 'Safety',
    tag: 'safety',
    color: '#e64980',
    icon: 'shield-alert',
    description: 'Collision avoidance, workspace boundary compliance, and safe human-robot interaction.',
    sub_metrics: [
      { sub_metric_id: 'collision_rate',            label: 'Collision Rate (\u2193)',     benchmark_name: 'RoboSuite Safety', benchmark_url: 'https://robosuite.ai/', invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'workspace_boundary',        label: 'Workspace Compliance',       benchmark_name: 'RoboSuite Safety', benchmark_url: 'https://robosuite.ai/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'human_proximity_compliance',label: 'Human Proximity Safety',     benchmark_name: 'SafetyGym',        benchmark_url: 'https://github.com/openai/safety-gym', invert: false, contamination_risk: 'low' },
    ],
  },
];

DOMAIN_SCHEMAS.weather = [
  {
    factor_id: 'forecast_accuracy',
    label: 'Forecast Accuracy',
    tag: 'accuracy',
    color: '#1971c2',
    icon: 'target',
    description: 'Root mean square error and anomaly correlation on key atmospheric variables.',
    sub_metrics: [
      { sub_metric_id: 'rmse_z500',  label: 'RMSE Z500 (m\u00B2/s\u00B2) (\u2193)', benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'rmse_t2m',   label: 'RMSE T2m (K) (\u2193)',                 benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'rmse_t850',  label: 'RMSE T850 (K) (\u2193)',                benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'acc_z500',   label: 'ACC Z500',                               benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'lead_time',
    label: 'Lead Time Scaling',
    tag: 'accuracy',
    color: '#0c8599',
    icon: 'clock',
    description: 'How well forecast skill holds as lead time increases from 1 to 15 days.',
    sub_metrics: [
      { sub_metric_id: 'day1_skill',  label: 'Day 1 Skill',  benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'day5_skill',  label: 'Day 5 Skill',  benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'day10_skill', label: 'Day 10 Skill', benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'extreme_events',
    label: 'Extreme Events',
    tag: 'specialization',
    color: '#e64980',
    icon: 'flame',
    description: 'Prediction skill for tropical cyclones, heatwaves, and extreme precipitation events.',
    sub_metrics: [
      { sub_metric_id: 'tc_track_error',         label: 'TC Track Error (km) (\u2193)',  benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'heatwave_detection',      label: 'Heatwave Detection F1',        benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'precipitation_extremes',  label: 'Precip Extreme Skill',         benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'probabilistic_skill',
    label: 'Probabilistic Skill',
    tag: 'accuracy',
    color: '#6741d9',
    icon: 'bar-chart-3',
    description: 'Calibration and sharpness of ensemble/probabilistic forecasts.',
    sub_metrics: [
      { sub_metric_id: 'crps_z500',             label: 'CRPS Z500 (\u2193)',        benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'spread_skill_ratio',     label: 'Spread-Skill Ratio',        benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'rank_histogram_reliability', label: 'Rank Histogram Reliability', benchmark_name: 'WeatherBench 2', benchmark_url: 'https://sites.research.google/gr/weatherbench/', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'resolution',
    label: 'Resolution & Coverage',
    tag: 'capability',
    color: '#2f9e44',
    icon: 'grid-3x3',
    description: 'Spatial, vertical, and temporal resolution of the forecast model.',
    sub_metrics: [
      { sub_metric_id: 'spatial_resolution_deg', label: 'Spatial Resolution (\u00B0) (\u2193)', benchmark_name: 'Model Spec', benchmark_url: '', invert: true, contamination_risk: 'na' },
      { sub_metric_id: 'vertical_levels',        label: 'Vertical Levels',                       benchmark_name: 'Model Spec', benchmark_url: '', invert: false, contamination_risk: 'na' },
      { sub_metric_id: 'temporal_resolution_hr', label: 'Temporal Resolution (hr) (\u2193)',     benchmark_name: 'Model Spec', benchmark_url: '', invert: true, contamination_risk: 'na' },
    ],
  },
  {
    factor_id: 'weather_efficiency',
    label: 'Computational Cost',
    tag: 'operations',
    color: '#f76707',
    icon: 'zap',
    description: 'Inference speed and compute requirements relative to traditional NWP systems.',
    sub_metrics: [
      { sub_metric_id: 'inference_time_s',         label: 'Inference Time (s) (\u2193)',   benchmark_name: 'Hardware Benchmark', benchmark_url: '', invert: true, contamination_risk: 'na' },
      { sub_metric_id: 'speedup_vs_nwp',           label: 'Speedup vs IFS',                benchmark_name: 'Published results',  benchmark_url: '', invert: false, contamination_risk: 'na' },
      { sub_metric_id: 'energy_per_forecast_kwh',  label: 'Energy/Forecast (kWh) (\u2193)',benchmark_name: 'Published results',  benchmark_url: '', invert: true, contamination_risk: 'na' },
    ],
  },
];

DOMAIN_SCHEMAS.materials = [
  {
    factor_id: 'property_prediction',
    label: 'Property Prediction',
    tag: 'accuracy',
    color: '#1971c2',
    icon: 'atom',
    description: 'Accuracy of predicting formation energy, band gap, and mechanical properties.',
    sub_metrics: [
      { sub_metric_id: 'formation_energy_mae', label: 'Formation Energy MAE (meV/atom) (\u2193)', benchmark_name: 'MatBench Discovery', benchmark_url: 'https://matbench-discovery.materialsproject.org/', invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'band_gap_mae',         label: 'Band Gap MAE (eV) (\u2193)',               benchmark_name: 'MatBench',           benchmark_url: 'https://matbench.materialsproject.org/',           invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'bulk_modulus_mae',      label: 'Bulk Modulus MAE (GPa) (\u2193)',          benchmark_name: 'MatBench',           benchmark_url: 'https://matbench.materialsproject.org/',           invert: true, contamination_risk: 'low' },
      { sub_metric_id: 'forces_mae',            label: 'Forces MAE (eV/\u00C5) (\u2193)',         benchmark_name: 'MPtrj',              benchmark_url: 'https://matbench-discovery.materialsproject.org/', invert: true, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'stability_discovery',
    label: 'Stability Discovery',
    tag: 'discovery',
    color: '#2f9e44',
    icon: 'search',
    description: 'Ability to identify thermodynamically stable crystals from candidates.',
    sub_metrics: [
      { sub_metric_id: 'f1_stable_crystals',    label: 'Stability F1 Score',         benchmark_name: 'MatBench Discovery', benchmark_url: 'https://matbench-discovery.materialsproject.org/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'precision_stable',       label: 'Stability Precision',        benchmark_name: 'MatBench Discovery', benchmark_url: 'https://matbench-discovery.materialsproject.org/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'recall_stable',          label: 'Stability Recall',           benchmark_name: 'MatBench Discovery', benchmark_url: 'https://matbench-discovery.materialsproject.org/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'hull_distance_mae',      label: 'Hull Distance MAE (\u2193)', benchmark_name: 'MatBench Discovery', benchmark_url: 'https://matbench-discovery.materialsproject.org/', invert: true, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'mat_generalization',
    label: 'Generalization',
    tag: 'adaptability',
    color: '#6741d9',
    icon: 'layers',
    description: 'Performance across unseen chemistries, element types, and crystal systems.',
    sub_metrics: [
      { sub_metric_id: 'cross_chemistry_accuracy',  label: 'Cross-Chemistry Accuracy',   benchmark_name: 'MatBench',           benchmark_url: 'https://matbench.materialsproject.org/', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'periodic_table_coverage',    label: 'Element Coverage (%)',        benchmark_name: 'Model Spec',         benchmark_url: '', invert: false, contamination_risk: 'na' },
      { sub_metric_id: 'unseen_element_performance', label: 'Unseen Element Performance', benchmark_name: 'Alexandria dataset', benchmark_url: 'https://alexandria.icams.rub.de/', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'structure_quality',
    label: 'Structure Generation',
    tag: 'discovery',
    color: '#e64980',
    icon: 'hexagon',
    description: 'Quality of generated crystal structures for generative materials discovery models.',
    sub_metrics: [
      { sub_metric_id: 'crystal_validity',     label: 'Crystal Validity (%)',    benchmark_name: 'MatterGen Eval', benchmark_url: 'https://github.com/microsoft/mattergen', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'structural_uniqueness', label: 'Structural Uniqueness',  benchmark_name: 'MatterGen Eval', benchmark_url: 'https://github.com/microsoft/mattergen', invert: false, contamination_risk: 'low' },
      { sub_metric_id: 'match_rate',           label: 'Match Rate (%)',          benchmark_name: 'MatterGen Eval', benchmark_url: 'https://github.com/microsoft/mattergen', invert: false, contamination_risk: 'low' },
    ],
  },
  {
    factor_id: 'mat_efficiency',
    label: 'Computational Cost',
    tag: 'operations',
    color: '#f76707',
    icon: 'gauge',
    description: 'Inference throughput and scaling for high-throughput screening workflows.',
    sub_metrics: [
      { sub_metric_id: 'atoms_per_second',  label: 'Atoms/Second',            benchmark_name: 'Hardware Benchmark', benchmark_url: '', invert: false, contamination_risk: 'na' },
      { sub_metric_id: 'gpu_memory_gb',     label: 'GPU Memory (GB) (\u2193)',benchmark_name: 'Model Spec',         benchmark_url: '', invert: true, contamination_risk: 'na' },
      { sub_metric_id: 'scaling_efficiency', label: 'Scaling Efficiency',      benchmark_name: 'Published results',  benchmark_url: '', invert: false, contamination_risk: 'na' },
    ],
  },
];

// Domain metadata for UI rendering
const DOMAIN_META = {
  llm: {
    id: 'llm',
    label: 'Language Models',
    shortLabel: 'LLMs',
    icon: 'message-square',
    color: '#6741d9',
    description: 'Large language models evaluated on reasoning, coding, safety, and more.',
  },
  robotics: {
    id: 'robotics',
    label: 'Robotics',
    shortLabel: 'Robotics',
    icon: 'bot',
    color: '#f76707',
    description: 'Robot foundation models evaluated on manipulation, planning, and generalization.',
  },
  weather: {
    id: 'weather',
    label: 'Weather & Physics',
    shortLabel: 'Weather',
    icon: 'cloud-sun',
    color: '#1971c2',
    description: 'Weather and climate forecasting models evaluated on accuracy, lead time, and extreme events.',
  },
  materials: {
    id: 'materials',
    label: 'Materials Science',
    shortLabel: 'Materials',
    icon: 'atom',
    color: '#2f9e44',
    description: 'Atomistic and crystal models evaluated on property prediction and stability discovery.',
  },
};

window.DomainSchemas = { DOMAIN_SCHEMAS, DOMAIN_META };
