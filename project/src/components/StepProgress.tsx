import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { WORKFLOW_PHASES, isPhaseComplete, isPhaseActive, getStatusMessage } from '../config/workflow';
import styles from './StepProgress.module.css';

interface StepProgressProps {
  currentStep: number;
  completedSteps: number[];
  isProcessing: boolean;
}

const StepProgress: React.FC<StepProgressProps> = ({ currentStep, completedSteps, isProcessing }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const visiblePhases = isMobile
    ? WORKFLOW_PHASES.filter((phase) => {
        const isCompleted = isPhaseComplete(phase.id, completedSteps);
        const isActive = isPhaseActive(phase.id, currentStep);
        return isCompleted || isActive;
      })
    : WORKFLOW_PHASES;

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressWrapper}>
        <div className={styles.phaseList}>
          {visiblePhases.map((phase, index) => {
            const isCompleted = isPhaseComplete(phase.id, completedSteps);
            const isActive = isPhaseActive(phase.id, currentStep);
            const state = isCompleted ? 'completed' : isActive ? 'active' : 'pending';
            const PhaseIcon = phase.icon;

            return (
              <React.Fragment key={phase.id}>
                <div className={styles.phaseItem}>
                  <div className={styles.phase}>
                    <div className={styles.phaseIcon} data-state={state}>
                      {isCompleted ? (
                        <Check size={24} />
                      ) : (
                        <PhaseIcon size={24} />
                      )}
                    </div>
                    <div className={styles.phaseLabel} data-state={state}>
                      {phase.label}
                    </div>
                  </div>
                </div>
                {index < visiblePhases.length - 1 && (
                  <div 
                    className={styles.phaseSeparator} 
                    data-completed={isCompleted.toString()}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      
      {isProcessing && (
        <div className={styles.statusContainer}>
          <p className={styles.statusText}>{getStatusMessage(currentStep)}</p>
        </div>
      )}
    </div>
  );
};

export default StepProgress;
