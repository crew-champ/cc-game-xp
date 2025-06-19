'use client';

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'katex/dist/katex.min.css';
import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { BlockMath } from 'react-katex';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

type PlayerProfile = 'wins-everything' | 'exceptional' | 'average' | 'looser';

const playerProfiles = {
  'wins-everything': {
    name: 'Wins Everything',
    icon: '👑',
    description: 'Elite player with exceptional skill',
    distribution: { first: 1.0, second: 0.0, third: 0.0, participation: 0.0 },
    color: 'bg-yellow-500 hover:bg-yellow-600 text-white'
  },
  'exceptional': {
    name: 'Exceptional',
    icon: '⭐',
    description: 'Above average competitive player',
    distribution: { first: 0.50, second: 0.25, third: 0.25, participation: 0.0 },
    color: 'bg-blue-500 hover:bg-blue-600 text-white'
  },
  'average': {
    name: 'Average',
    icon: '🎮',
    description: 'Typical casual player',
    distribution: { first: 0.20, second: 0.20, third: 0.30, participation: 0.30 },
    color: 'bg-green-500 hover:bg-green-600 text-white'
  },
  'looser': {
    name: 'Looser',
    icon: '😅',
    description: 'Struggling or new player',
    distribution: { first: 0.0, second: 0.0, third: 0.0, participation: 1.0 },
    color: 'bg-gray-500 hover:bg-gray-600 text-white'
  }
};

// Game duration definitions (in days)
const GAME_DURATIONS = {
  daily: 1,
  weekly: 7,
  monthly: 30
};

export default function XPCalculator() {
  // Player profile selection
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile>('average');
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Loading state
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  
  // Level list visibility state
  const [showLevelList, setShowLevelList] = useState<boolean>(false);
  
  // Game frequency inputs
  const [dailyGames, setDailyGames] = useState<number>(2);
  const [weeklyGames, setWeeklyGames] = useState<number>(3);
  const [monthlyGames, setMonthlyGames] = useState<number>(1);
  
  // Points per day by placement
  const [firstPlacePointsPerDay, setFirstPlacePointsPerDay] = useState<number>(5);
  const [secondPlacePointsPerDay, setSecondPlacePointsPerDay] = useState<number>(3);
  const [thirdPlacePointsPerDay, setThirdPlacePointsPerDay] = useState<number>(2);
  const [participationPointsPerDay, setParticipationPointsPerDay] = useState<number>(1);

  // Polynomial coefficients - immediate and debounced versions
  const [polyA, setPolyA] = useState<number>(0.035); // x^2 coefficient
  const [polyB, setPolyB] = useState<number>(2.5); // x coefficient
  const [polyC, setPolyC] = useState<number>(10); // constant
  const [polyMultiplier, setPolyMultiplier] = useState<number>(0.5); // final multiplier
  
  const [debouncedPolyA, setDebouncedPolyA] = useState<number>(0.035);
  const [debouncedPolyB, setDebouncedPolyB] = useState<number>(2.5);
  const [debouncedPolyC, setDebouncedPolyC] = useState<number>(10);
  const [debouncedPolyMultiplier, setDebouncedPolyMultiplier] = useState<number>(0.5);
  
  // Debounce effect for formula values
  useEffect(() => {
    setIsCalculating(true);
    const timeout = setTimeout(() => {
      setDebouncedPolyA(polyA);
      setDebouncedPolyB(polyB);
      setDebouncedPolyC(polyC);
      setDebouncedPolyMultiplier(polyMultiplier);
      setIsCalculating(false);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeout);
  }, [polyA, polyB, polyC, polyMultiplier]);

  // Get current player profile
  const currentProfile = playerProfiles[selectedProfile];

  // Leveling system functions that use the polynomial formula
  const calculateXPForLevel = (level: number): number => {
    // Polynomial approach: XP = (ax^2 + bx + c) × multiplier
    // Example: (65x^2 - 165x - 6750) × 0.82
    const polynomialValue = (debouncedPolyA * Math.pow(level, 2)) + (debouncedPolyB * level) + debouncedPolyC;
    const result = polynomialValue * debouncedPolyMultiplier;
    return Math.max(1, Math.floor(result)); // Ensure minimum of 1 XP per level
  };

  const calculateTotalXPToLevel = (targetLevel: number): number => {
    let totalXP = 0;
    for (let level = 1; level <= targetLevel; level++) {
      totalXP += calculateXPForLevel(level);
    }
    return totalXP;
  };

  const calculateLevelFromXP = (totalXP: number): number => {
    let level = 1;
    let xpUsed = 0;
    
    while (xpUsed + calculateXPForLevel(level) <= totalXP) {
      xpUsed += calculateXPForLevel(level);
      level++;
    }
    
    return level - 1; // Return the completed level
  };

  const calculateXPProgress = (totalXP: number): { currentLevel: number, xpInLevel: number, xpNeededForNext: number, progressPercent: number } => {
    const currentLevel = calculateLevelFromXP(totalXP);
    const xpUsedForCompletedLevels = calculateTotalXPToLevel(currentLevel);
    const xpInLevel = totalXP - xpUsedForCompletedLevels;
    const xpNeededForNext = calculateXPForLevel(currentLevel + 1);
    const progressPercent = (xpInLevel / xpNeededForNext) * 100;
    
    return {
      currentLevel,
      xpInLevel,
      xpNeededForNext,
      progressPercent
    };
  };

  // Calculate cumulative points data for line chart (day by day)
  const chartData = useMemo(() => {
    const days = Array.from({ length: 365 }, (_, i) => i + 1);
    const placementDistribution = currentProfile.distribution;
    
    // Seeded random number generator for consistent results (same as annotations)
    const seedRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    
    // Function to determine placement based on distribution and random roll (same as annotations)
    const rollPlacement = (seed: number) => {
      const roll = seedRandom(seed);
      
      if (roll < placementDistribution.first) return 'first';
      if (roll < placementDistribution.first + placementDistribution.second) return 'second';
      if (roll < placementDistribution.first + placementDistribution.second + placementDistribution.third) return 'third';
      return 'participation';
    };
    
    // Function to get points for a placement
    const getPointsForPlacement = (placement: string, gameDuration: number) => {
      switch (placement) {
        case 'first': return firstPlacePointsPerDay * gameDuration;
        case 'second': return secondPlacePointsPerDay * gameDuration;
        case 'third': return thirdPlacePointsPerDay * gameDuration;
        default: return participationPointsPerDay; // Participation doesn't scale with duration
      }
    };
    
    let cumulativePoints = 0;
    const dailyPointsData: number[] = [];
    const dailyLevelsData: number[] = [];
    const labels: string[] = [];
    
    let weekCount = 0;
    let monthCount = 0;
    
    days.forEach((day) => {
      // Calculate which month this day falls in
      const month = Math.floor((day - 1) / 30.44); // Approximate days per month
      const dayOfWeek = day % 7;
      const isMonthEnd = day % 30 === 0; // Monthly games complete every 30 days
      
      // Calculate games that complete this day and award points
      let totalDailyPoints = 0;
      
      // Daily games complete every day (but players only participate 5 days/week)
      if (dailyGames > 0) {
        const weeklyParticipationRate = 5/7; // Players only play 5 days per week
        const adjustedDailyGames = Math.round(dailyGames * weeklyParticipationRate * getSeasonalMultiplier(month) * getDailyVariation(day));
        
        // For daily games, use statistical distribution since they're not shown as lines
        const dailyGamePoints = calculateGameTypePoints(adjustedDailyGames, placementDistribution, GAME_DURATIONS.daily);
        totalDailyPoints += dailyGamePoints;
      }
      
      // Weekly games complete every 7 days (every Sunday) - use actual simulated results
      if (dayOfWeek === 0 && weeklyGames > 0) {
        weekCount++;
        const adjustedWeeklyGames = Math.round(weeklyGames * getSeasonalMultiplier(month) * getDailyVariation(day));
        
        // Simulate each weekly game individually
        for (let gameIndex = 0; gameIndex < adjustedWeeklyGames; gameIndex++) {
          const seed = (weekCount * 1000) + gameIndex + (selectedProfile === 'wins-everything' ? 1 : 
                      selectedProfile === 'exceptional' ? 2 : 
                      selectedProfile === 'average' ? 3 : 4);
          const placement = rollPlacement(seed);
          const gamePoints = getPointsForPlacement(placement, GAME_DURATIONS.weekly);
          totalDailyPoints += gamePoints;
        }
      }
      
      // Monthly games complete every 30 days - use actual simulated results
      if (isMonthEnd && monthlyGames > 0) {
        monthCount++;
        const adjustedMonthlyGames = Math.round(monthlyGames * getSeasonalMultiplier(month));
        
        // Simulate each monthly game individually
        for (let gameIndex = 0; gameIndex < adjustedMonthlyGames; gameIndex++) {
          const seed = (monthCount * 10000) + gameIndex + (selectedProfile === 'wins-everything' ? 100 : 
                      selectedProfile === 'exceptional' ? 200 : 
                      selectedProfile === 'average' ? 300 : 400);
          const placement = rollPlacement(seed);
          const gamePoints = getPointsForPlacement(placement, GAME_DURATIONS.monthly);
          totalDailyPoints += gamePoints;
        }
      }
      
      cumulativePoints += totalDailyPoints;
      dailyPointsData.push(cumulativePoints);
      
      // Calculate current level
      const currentLevel = calculateLevelFromXP(cumulativePoints);
      dailyLevelsData.push(currentLevel);
      
      // Create labels (show every 2 weeks for readability)
      if (day % 14 === 1 || day === 1) {
        const date = new Date(2024, 0, day);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      } else {
        labels.push('');
      }
    });

    // Helper function to calculate points for a game type (used only for daily games now)
    function calculateGameTypePoints(gameCount: number, distribution: { first: number; second: number; third: number; participation: number }, gameDuration: number): number {
      const firstPlaceGames = Math.floor(gameCount * distribution.first);
      const secondPlaceGames = Math.floor(gameCount * distribution.second);
      const thirdPlaceGames = Math.floor(gameCount * distribution.third);
      const participationGames = gameCount - firstPlaceGames - secondPlaceGames - thirdPlaceGames;
      
      return (
        (firstPlaceGames * firstPlacePointsPerDay * gameDuration) +
        (secondPlaceGames * secondPlacePointsPerDay * gameDuration) +
        (thirdPlaceGames * thirdPlacePointsPerDay * gameDuration) +
        (participationGames * participationPointsPerDay) // Participation doesn't scale with duration
      );
    }
    
    function getSeasonalMultiplier(month: number): number {
      return month >= 5 && month <= 7 ? 0.8 : month >= 10 || month <= 1 ? 1.2 : 1.0;
    }
    
    function getDailyVariation(day: number): number {
      return 0.85 + (Math.sin(day * 0.1) * 0.15);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Cumulative XP Points',
          data: dailyPointsData,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'Player Level',
          data: dailyLevelsData,
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: 'y1',
        },
      ],
    };
  }, [dailyGames, weeklyGames, monthlyGames, firstPlacePointsPerDay, secondPlacePointsPerDay, thirdPlacePointsPerDay, participationPointsPerDay, selectedProfile, calculateLevelFromXP, currentProfile.distribution]);

  // Generate game completion annotations
  const generateGameAnnotations = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const annotations: any = {};
    const placementDistribution = currentProfile.distribution;
    
    // Seeded random number generator for consistent results
    const seedRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    
    // Function to determine placement based on distribution and random roll
    const rollPlacement = (seed: number) => {
      const roll = seedRandom(seed);
      
      if (roll < placementDistribution.first) return 'first';
      if (roll < placementDistribution.first + placementDistribution.second) return 'second';
      if (roll < placementDistribution.first + placementDistribution.second + placementDistribution.third) return 'third';
      return 'participation';
    };
    
    const getPlacementColor = (placement: string) => {
      switch (placement) {
        case 'first': return 'rgba(255, 215, 0, 0.5)';   // Gold with 50% opacity
        case 'second': return 'rgba(192, 192, 192, 0.5)';  // Silver with 50% opacity
        case 'third': return 'rgba(205, 127, 50, 0.5)';   // Bronze with 50% opacity
        default: return 'rgba(156, 163, 175, 0.5)';        // Gray with 50% opacity
      }
    };
    
    // Add weekly game completion lines (dashed)
    if (weeklyGames > 0) {
      let weekCount = 0;
      for (let day = 7; day <= 365; day += 7) {
        weekCount++;
        
        // For each weekly game scheduled, roll for placement
        for (let gameIndex = 0; gameIndex < weeklyGames; gameIndex++) {
          const seed = (weekCount * 1000) + gameIndex + (selectedProfile === 'wins-everything' ? 1 : 
                      selectedProfile === 'exceptional' ? 2 : 
                      selectedProfile === 'average' ? 3 : 4); // Different seeds per profile
          const placement = rollPlacement(seed);
          const color = getPlacementColor(placement);
          
          annotations[`weekly_${day}_${gameIndex}`] = {
            type: 'line',
            xMin: day - 1, // Convert to 0-indexed
            xMax: day - 1,
            borderColor: color,
            borderWidth: 0.5,
            borderDash: [5, 5],
            label: {
              content: placement.charAt(0).toUpperCase(),
              enabled: false,
            }
          };
        }
      }
    }
    
    // Add monthly game completion lines (solid)
    if (monthlyGames > 0) {
      let monthCount = 0;
      for (let day = 30; day <= 365; day += 30) {
        monthCount++;
        
        // For each monthly game scheduled, roll for placement
        for (let gameIndex = 0; gameIndex < monthlyGames; gameIndex++) {
          const seed = (monthCount * 10000) + gameIndex + (selectedProfile === 'wins-everything' ? 100 : 
                      selectedProfile === 'exceptional' ? 200 : 
                      selectedProfile === 'average' ? 300 : 400); // Different seeds per profile
          const placement = rollPlacement(seed);
          const color = getPlacementColor(placement);
          
          annotations[`monthly_${day}_${gameIndex}`] = {
            type: 'line',
            xMin: day - 1, // Convert to 0-indexed
            xMax: day - 1,
            borderColor: color,
            borderWidth: 1,
            label: {
              content: placement.charAt(0).toUpperCase(),
              enabled: false,
            }
          };
        }
      }
    }
    
    return annotations;
  }, [weeklyGames, monthlyGames, currentProfile, selectedProfile]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `XP & Level Progress Over the Year - ${currentProfile.name} Player`,
      },
      tooltip: {
        callbacks: {
          title: function(context: { dataIndex: number }[]) {
            const dayOfYear = context[0].dataIndex + 1;
            const date = new Date(2024, 0, dayOfYear);
            const dateStr = date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            });
            return [`Day ${dayOfYear} of Year`, dateStr];
          },
          label: function(context: { dataset: { label?: string }; parsed: { y: number } }) {
            const datasetLabel = context.dataset.label || '';
            const value = context.parsed.y;
            
            if (datasetLabel === 'Cumulative XP Points') {
              return `${datasetLabel}: ${value.toLocaleString()} XP`;
            } else if (datasetLabel === 'Player Level') {
              return `${datasetLabel}: ${value}`;
            }
            return `${datasetLabel}: ${value}`;
          }
        }
      },
      annotation: {
        annotations: generateGameAnnotations
      }
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cumulative XP Points',
        },
        ticks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: function(value: any) {
            return value.toLocaleString();
          }
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Player Level',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      x: {
        title: {
          display: true,
          text: 'Day of Year',
        },
        ticks: {
          maxTicksLimit: 20,
        }
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  // Calculate yearly stats
  const totalGamesPerYear = useMemo(() => {
    const dailyTotal = dailyGames * 365;
    const weeklyTotal = weeklyGames * 52;
    const monthlyTotal = monthlyGames * 12;
    return dailyTotal + weeklyTotal + monthlyTotal;
  }, [dailyGames, weeklyGames, monthlyGames]);

  const totalPointsPerYear = chartData.datasets[0].data[364] || 0; // Last day's cumulative total
  const finalLevel = chartData.datasets[1].data[364] || 1; // Last day's level
  const avgPointsPerMonth = Math.round(totalPointsPerYear / 12);
  const avgPointsPerGame = Math.round(totalPointsPerYear / totalGamesPerYear);
  const avgPointsPerDay = Math.round(totalPointsPerYear / 365);
  
  // Calculate current level progress
  const levelProgress = calculateXPProgress(totalPointsPerYear);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      {/* Fullscreen Chart Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
          {/* Fullscreen Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              XP & Level Progress - {currentProfile.name} Player (Fullscreen)
            </h1>
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <span>✕</span>
              Exit Fullscreen
            </button>
          </div>
          
          {/* Fullscreen Chart */}
          <div className="flex-1 p-6">
            <Line data={chartData} options={{
              ...chartOptions,
              maintainAspectRatio: false,
              responsive: true,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  display: false, // Hide title in fullscreen since it's in header
                },
              }
            }} />
          </div>
          
          {/* Fullscreen Legend */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="max-w-4xl mx-auto">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Game Completion Markers
              </h4>
              <div className="flex flex-wrap gap-8 text-sm justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 border-t-2 border-dashed border-gray-400"></div>
                  <span className="text-gray-600 dark:text-gray-400">Weekly Games (Every Sunday)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 border-t-2 border-gray-400"></div>
                  <span className="text-gray-600 dark:text-gray-400">Monthly Games (Every 30 Days)</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5" style={{ backgroundColor: '#FFD700' }}></div>
                    <span className="text-gray-600 dark:text-gray-400">🥇 1st</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5" style={{ backgroundColor: '#C0C0C0' }}></div>
                    <span className="text-gray-600 dark:text-gray-400">🥈 2nd</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5" style={{ backgroundColor: '#CD7F32' }}></div>
                    <span className="text-gray-600 dark:text-gray-400">🥉 3rd</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5" style={{ backgroundColor: '#9CA3AF' }}></div>
                    <span className="text-gray-600 dark:text-gray-400">🎮 Participation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            XP Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Game Platform Analytics & Point Distribution
          </p>
        </div>

        {/* Player Profile Buttons */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
            Select Player Profile
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(playerProfiles).map(([key, profile]) => (
              <button
                key={key}
                onClick={() => setSelectedProfile(key as PlayerProfile)}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-200 text-center
                  ${selectedProfile === key 
                    ? `${profile.color} border-gray-900 dark:border-white shadow-lg scale-105` 
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                `}
              >
                <div className="text-2xl mb-2">{profile.icon}</div>
                <div className="font-semibold text-sm">{profile.name}</div>
                <div className="text-xs mt-1 opacity-75">{profile.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-8" style={{ gridTemplateColumns: showLevelList ? '1fr 2fr 1fr' : '1fr 3fr' }}>
          {/* Input Controls */}
          <div className="">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Game Completion Schedule
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label 
                    htmlFor="dailyGames" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Daily Games (complete each day)
                  </label>
                  <input
                    type="number"
                    id="dailyGames"
                    min="0"
                    max="20"
                    value={dailyGames}
                    onChange={(e) => setDailyGames(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Players participate 5 days per week (5/7 rate)
                  </p>
                </div>

                <div>
                  <label 
                    htmlFor="weeklyGames" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Weekly Games (complete every Sunday)
                  </label>
                  <input
                    type="number"
                    id="weeklyGames"
                    min="0"
                    max="50"
                    value={weeklyGames}
                    onChange={(e) => setWeeklyGames(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Players participate in all weekly games
                  </p>
                </div>

                <div>
                  <label 
                    htmlFor="monthlyGames" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Monthly Games (complete every 30 days)
                  </label>
                  <input
                    type="number"
                    id="monthlyGames"
                    min="0"
                    max="20"
                    value={monthlyGames}
                    onChange={(e) => setMonthlyGames(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Players participate in all monthly games
                  </p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-4">
                Points per Day by Placement
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label 
                    htmlFor="firstPlace" 
                    className="block text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2"
                  >
                    🥇 1st Place (points/day)
                  </label>
                  <input
                    type="number"
                    id="firstPlace"
                    min="0"
                    max="100"
                    value={firstPlacePointsPerDay}
                    onChange={(e) => setFirstPlacePointsPerDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label 
                    htmlFor="secondPlace" 
                    className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2"
                  >
                    🥈 2nd Place (points/day)
                  </label>
                  <input
                    type="number"
                    id="secondPlace"
                    min="0"
                    max="75"
                    value={secondPlacePointsPerDay}
                    onChange={(e) => setSecondPlacePointsPerDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label 
                    htmlFor="thirdPlace" 
                    className="block text-sm font-medium text-amber-600 dark:text-amber-400 mb-2"
                  >
                    🥉 3rd Place (points/day)
                  </label>
                  <input
                    type="number"
                    id="thirdPlace"
                    min="0"
                    max="50"
                    value={thirdPlacePointsPerDay}
                    onChange={(e) => setThirdPlacePointsPerDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label 
                    htmlFor="participation" 
                    className="block text-sm font-medium text-green-600 dark:text-green-400 mb-2"
                  >
                    🎮 Participation (points/day)
                  </label>
                  <input
                    type="number"
                    id="participation"
                    min="0"
                    max="25"
                    value={participationPointsPerDay}
                    onChange={(e) => setParticipationPointsPerDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Level Progress */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Level Progress
                </h3>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      Level {levelProgress.currentLevel}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Final Level at Year End
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div 
                        className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${levelProgress.progressPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <span>{levelProgress.xpInLevel.toLocaleString()} XP</span>
                      <span>{levelProgress.xpNeededForNext.toLocaleString()} XP needed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Yearly Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Games:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {totalGamesPerYear.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Points:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {totalPointsPerYear.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Final Level:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {finalLevel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg/Month:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {avgPointsPerMonth.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg/Game:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {avgPointsPerGame.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg/Day:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {avgPointsPerDay.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 relative">
              {/* Loading Overlay */}
              {isCalculating && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 rounded-lg flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                      Recalculating year&apos;s progression...
                    </div>
                  </div>
                </div>
              )}
              
              {/* Fullscreen Button */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="absolute top-4 right-4 z-10 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
                title="View in fullscreen"
              >
                <span>⛶</span>
                Fullscreen
              </button>
              <Line data={chartData} options={chartOptions} />
            </div>
            
            {/* Mathematical Formula Display */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Polynomial Leveling Formula
              </h3>
              
              {/* Polynomial Coefficients */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label 
                    htmlFor="polyA" 
                    className="block text-sm font-medium text-purple-600 dark:text-purple-400 mb-2"
                  >
                    📈 A (x² coefficient)
                    {isCalculating && <span className="ml-2 text-xs text-orange-500">⏳</span>}
                  </label>
                  <input
                    type="number"
                    id="polyA"
                    value={polyA}
                    onChange={(e) => setPolyA(Number(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors ${
                      isCalculating 
                        ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                </div>
                
                <div>
                  <label 
                    htmlFor="polyB" 
                    className="block text-sm font-medium text-purple-600 dark:text-purple-400 mb-2"
                  >
                    📊 B (x coefficient)
                    {isCalculating && <span className="ml-2 text-xs text-orange-500">⏳</span>}
                  </label>
                  <input
                    type="number"
                    id="polyB"
                    value={polyB}
                    onChange={(e) => setPolyB(Number(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors ${
                      isCalculating 
                        ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                </div>
                
                <div>
                  <label 
                    htmlFor="polyC" 
                    className="block text-sm font-medium text-purple-600 dark:text-purple-400 mb-2"
                  >
                    📋 C (constant)
                    {isCalculating && <span className="ml-2 text-xs text-orange-500">⏳</span>}
                  </label>
                  <input
                    type="number"
                    id="polyC"
                    value={polyC}
                    onChange={(e) => setPolyC(Number(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors ${
                      isCalculating 
                        ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                </div>
                
                <div>
                  <label 
                    htmlFor="polyMultiplier" 
                    className="block text-sm font-medium text-purple-600 dark:text-purple-400 mb-2"
                  >
                    ✖️ Multiplier
                    {isCalculating && <span className="ml-2 text-xs text-orange-500">⏳</span>}
                  </label>
                  <input
                    type="number"
                    id="polyMultiplier"
                    step="0.01"
                    value={polyMultiplier}
                    onChange={(e) => setPolyMultiplier(Number(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors ${
                      isCalculating 
                        ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                </div>
              </div>
              
              {/* Preset Buttons */}
              <div className="mb-6 border-t pt-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Quick Presets:
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setPolyA(65);
                      setPolyB(-165);
                      setPolyC(-6750);
                      setPolyMultiplier(0.82);
                    }}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                  >
                    Your Example (65x² - 165x - 6750) × 0.82
                  </button>
                  <button
                    onClick={() => {
                      setPolyA(10);
                      setPolyB(50);
                      setPolyC(100);
                      setPolyMultiplier(1.0);
                    }}
                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
                  >
                    Linear Growth
                  </button>
                  <button
                    onClick={() => {
                      setPolyA(25);
                      setPolyB(0);
                      setPolyC(0);
                      setPolyMultiplier(1.0);
                    }}
                    className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm transition-colors"
                  >
                    Pure Quadratic
                  </button>
                  <button
                    onClick={() => {
                      setPolyA(0);
                      setPolyB(100);
                      setPolyC(0);
                      setPolyMultiplier(1.0);
                    }}
                    className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm transition-colors"
                  >
                    Flat Rate
                  </button>
                  <button
                    onClick={() => {
                      setPolyA(0.035);
                      setPolyB(2.5);
                      setPolyC(10);
                      setPolyMultiplier(0.5);
                    }}
                    className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm transition-colors"
                  >
                    Level 500 = 10k XP
                  </button>
                </div>
              </div>
              
              {/* Live Formula Display */}
              <div className="text-center border-t pt-4">
                <div className="text-gray-700 dark:text-gray-300 mb-2">XP required for next level:</div>
                <BlockMath math={`\\text{XP}_{\\text{level}} = (${debouncedPolyA}x^2 + ${debouncedPolyB}x + ${debouncedPolyC}) \\times ${debouncedPolyMultiplier}`} />
                
                <div className="text-gray-700 dark:text-gray-300 mt-4 mb-2">Where x = level number</div>
                
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {[1, 10, 50, 100].map((level) => {
                      const xpNeeded = calculateXPForLevel(level);
                      return (
                        <div key={level} className={`p-3 rounded-lg text-center transition-colors ${
                          isCalculating 
                            ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-600' 
                            : 'bg-gray-50 dark:bg-gray-700/50'
                        }`}>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">Level {level}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {xpNeeded.toLocaleString()} XP
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                    * Examples update in real-time as you adjust the polynomial coefficients
                    {isCalculating && <span className="block text-orange-500 mt-1">⏳ Calculations in progress...</span>}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Game Completion Legend */}
            <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Game Completion Markers
              </h4>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 border-t-2 border-dashed border-gray-400"></div>
                    <span className="text-gray-600 dark:text-gray-400">Weekly Games (Every Sunday)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 border-t-2 border-gray-400"></div>
                    <span className="text-gray-600 dark:text-gray-400">Monthly Games (Every 30 Days)</span>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Line Colors by Placement:
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5" style={{ backgroundColor: '#FFD700' }}></div>
                      <span className="text-gray-600 dark:text-gray-400">🥇 1st Place</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5" style={{ backgroundColor: '#C0C0C0' }}></div>
                      <span className="text-gray-600 dark:text-gray-400">🥈 2nd Place</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5" style={{ backgroundColor: '#CD7F32' }}></div>
                      <span className="text-gray-600 dark:text-gray-400">🥉 3rd Place</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5" style={{ backgroundColor: '#9CA3AF' }}></div>
                      <span className="text-gray-600 dark:text-gray-400">🎮 Participation</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  * Each line shows the actual placement result for that specific game completion
                </div>
              </div>
            </div>
          </div>

          {/* Level List Panel */}
          {showLevelList && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Level XP Requirements
                </h3>
                <button
                  onClick={() => setShowLevelList(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="Hide level list"
                >
                  ✕
                </button>
              </div>
              
              <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                Formula: ({debouncedPolyA}x² + {debouncedPolyB}x + {debouncedPolyC}) × {debouncedPolyMultiplier}
              </div>
              
              {/* Level Grid with improved padding and height */}
              <div className="max-h-[600px] overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="text-left px-2 py-2 font-semibold text-gray-900 dark:text-white">Level</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-900 dark:text-white">XP</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-900 dark:text-white text-xs">XP to Next</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 500 }, (_, i) => i + 1).map((level) => {
                      const xpNeeded = Math.floor(calculateXPForLevel(level));
                      const xpToNext = level < 500 ? Math.floor(calculateXPForLevel(level + 1)) : 0;
                      return (
                        <tr
                          key={level}
                          className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          title={`Level ${level}: ${xpNeeded.toLocaleString()} XP${level < 500 ? `, ${xpToNext.toLocaleString()} XP to next` : ''}`}
                        >
                          <td className="px-2 py-1 font-medium text-gray-900 dark:text-white">
                            {level}
                          </td>
                          <td className="px-2 py-1 text-right text-gray-600 dark:text-gray-400 font-mono">
                            {xpNeeded.toLocaleString()}
                          </td>
                          <td className="px-2 py-1 text-right text-gray-500 dark:text-gray-500 font-mono text-xs">
                            {level < 500 ? xpToNext.toLocaleString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Quick Stats */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="font-semibold text-blue-600 dark:text-blue-400">L1</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {Math.floor(calculateXPForLevel(1)).toLocaleString()}
                  </div>
                </div>
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="font-semibold text-red-600 dark:text-red-400">L500</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {Math.floor(calculateXPForLevel(500)).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating Toggle Button */}
        {!showLevelList && (
          <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-30">
            <button
              onClick={() => setShowLevelList(true)}
              className="p-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-l-lg shadow-lg flex flex-col items-center gap-1 transition-colors"
              title="Show level XP requirements"
            >
              <span className="text-sm">📋</span>
              <span className="text-xs writing-mode-vertical">Levels</span>
            </button>
          </div>
        )}

        {/* Additional Insights */}
        <div className="mt-8 grid md:grid-cols-5 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {finalLevel}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Final Level
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totalGamesPerYear.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Total Games/Year
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {avgPointsPerGame}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Avg Points/Game
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {Math.round(totalGamesPerYear / 365)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Games per Day
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {avgPointsPerDay}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Points per Day
            </div>
          </div>
        </div>

        {/* Placement Distribution Info */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {currentProfile.name} Player Distribution Model
          </h3>
          <div className="grid md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl">🥇</div>
              <div className="font-semibold text-yellow-700 dark:text-yellow-300">
                {Math.round(currentProfile.distribution.first * 100)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">1st Place</div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl">🥈</div>
              <div className="font-semibold text-gray-700 dark:text-gray-300">
                {Math.round(currentProfile.distribution.second * 100)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">2nd Place</div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-2xl">🥉</div>
              <div className="font-semibold text-amber-700 dark:text-amber-300">
                {Math.round(currentProfile.distribution.third * 100)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">3rd Place</div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl">🎮</div>
              <div className="font-semibold text-green-700 dark:text-green-300">
                {Math.round(currentProfile.distribution.participation * 100)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Participation</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
