import React from 'react';
import { vscode } from '../vscode';

interface SkillCardProps {
  id: string;
  name: string;
  description: string;
  repository?: string;
  stars?: number;
  updatedAt?: string;
  installed?: boolean;
  hasUpdate?: boolean;
  onInstall?: () => void;
  onUpdate?: () => void;
  onRemove?: () => void;
  onViewDetails?: () => void;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  id,
  name,
  description,
  repository,
  stars,
  updatedAt,
  installed = false,
  hasUpdate = false,
  onInstall,
  onUpdate,
  onRemove,
  onViewDetails
}) => {
  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails();
    } else {
      vscode.postMessage({
        type: 'viewSkill',
        skill: { id, name, description, repository }
      });
    }
  };

  return (
    <div className={`skill-card ${installed ? 'installed' : ''} ${hasUpdate ? 'has-update' : ''}`}>
      {/* Card Header */}
      <div className="skill-card-header">
        <h3 className="skill-name">{name}</h3>
        {installed && (
          <span className="badge installed-badge">Installed</span>
        )}
        {hasUpdate && (
          <span className="badge update-badge">Update Available</span>
        )}
      </div>

      {/* Description */}
      <p className="skill-description">{description}</p>

      {/* Metadata */}
      {(repository || stars || updatedAt) && (
        <div className="skill-metadata">
          {repository && (
            <span className="metadata-item">
              <span className="codicon codicon-repository" aria-hidden="true" />
              {repository.replace('https://github.com/', '')}
            </span>
          )}
          {stars !== undefined && stars > 0 && (
            <span className="metadata-item">
              <span className="codicon codicon-star-full" aria-hidden="true" />
              {stars}
            </span>
          )}
          {updatedAt && (
            <span className="metadata-item">
              <span className="codicon codicon-clock" aria-hidden="true" />
              {new Date(updatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="skill-actions">
        <button
          className="action-button secondary"
          onClick={handleViewDetails}
          title="View skill details"
        >
          <span className="codicon codicon-preview" aria-hidden="true" />
          View
        </button>

        {!installed && onInstall && (
          <button
            className="action-button primary"
            onClick={onInstall}
            title="Install skill"
          >
            <span className="codicon codicon-cloud-download" aria-hidden="true" />
            Install
          </button>
        )}

        {installed && onRemove && (
          <button
            className="action-button danger"
            onClick={onRemove}
            title="Remove skill"
          >
            <span className="codicon codicon-trash" aria-hidden="true" />
            Remove
          </button>
        )}

        {hasUpdate && onUpdate && (
          <button
            className="action-button primary"
            onClick={onUpdate}
            title="Update skill"
          >
            <span className="codicon codicon-sync" aria-hidden="true" />
            Update
          </button>
        )}
      </div>
    </div>
  );
};
