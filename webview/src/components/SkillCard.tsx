import React, { useState } from 'react';
import { vscode } from '../vscode';
import { SkillCardProps, getAgentTagConfig } from '../types';

export const SkillCard: React.FC<SkillCardProps> = ({
  id,
  name,
  description,
  agentType,
  scope,
  installed = false,
  hasUpdate = false,
  repository,
  skillMdUrl,
  source,
  stars,
  updatedAt,
  onInstall,
  onRemove,
  onUpdate,
  onViewDetails
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Ensure tagConfig is never undefined
  const tagConfig = getAgentTagConfig(agentType) || {
    label: agentType.replace('-', ' ').replace(/^\w/, c => c.toUpperCase()),
    color: '#6B7280',
    bg: 'rgba(107, 114, 128, 0.1)',
    borderColor: 'rgba(107, 114, 128, 0.2)',
  };

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails();
    } else {
      vscode.postMessage({
        type: 'viewSkill',
        skill: {
          id,
          name,
          description,
          repository,
          skillMdUrl,
          source,
          agentType,
          scope
        }
      });
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);

    switch (action) {
      case 'install':
        onInstall?.();
        break;
      case 'remove':
        onRemove?.();
        break;
      case 'update':
        onUpdate?.();
        break;
      case 'viewDetails':
        handleCardClick();
        break;
    }
  };

  return (
    <div
      className={`skill-card ${scope} ${isHovered ? 'hovered' : ''}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
    >
      {/* IDE Tag + Title + Actions Row */}
      <div className="skill-card-header">
        <div className="skill-header-left">
          {/* IDE Tag - only show for installed skills that are not universal */}
          {installed && agentType !== 'universal' && (
            <span
              className="ide-tag"
              style={{
                backgroundColor: tagConfig.bg,
                color: tagConfig.color,
                borderColor: tagConfig.borderColor
              }}
            >
              {tagConfig.label}
            </span>
          )}

          {/* Skill Name */}
          <h3 className="skill-name">{name}</h3>
        </div>

        {/* Three-dot Menu (visible on hover) */}
        <div className="skill-actions-wrapper" style={{ opacity: isHovered ? 1 : 0 }}>
          <div className="action-menu">
            <button
              className="menu-button"
              onClick={handleMenuClick}
              title="操作"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5"/>
                <circle cx="8" cy="8" r="1.5"/>
                <circle cx="8" cy="13" r="1.5"/>
              </svg>
            </button>

            {showMenu && (
              <div className="dropdown-menu">
                {installed ? (
                  <>
                    <div
                      className="menu-item"
                      onClick={(e) => handleAction('viewDetails', e)}
                    >
                      打开文档
                    </div>
                    {hasUpdate && (
                      <div
                        className="menu-item"
                        onClick={(e) => handleAction('update', e)}
                      >
                        更新
                      </div>
                    )}
                    <div className="menu-divider"/>
                    <div
                      className="menu-item danger"
                      onClick={(e) => handleAction('remove', e)}
                    >
                      卸载
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="menu-item primary"
                      onClick={(e) => handleAction('install', e)}
                    >
                      安装
                    </div>
                    {repository && (
                      <div
                        className="menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          vscode.postMessage({
                            type: 'openRepository',
                            url: repository
                          });
                        }}
                      >
                        查看仓库
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description (2-line clamp) */}
      <p className="skill-description">{description}</p>
    </div>
  );
};
