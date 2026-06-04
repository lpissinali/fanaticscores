'use client';
import { useFollowing } from '../../../lib/useFollowing';
import Icon from '../Icon/Icon';
import styles from './FollowButton.module.css';

interface Props {
  teamId: string;
  teamName: string;
  teamCrest?: string;
  tla?: string;
}

export default function FollowButton({ teamId, teamName, teamCrest, tla }: Props) {
  const teamObj = {
    id:      teamId,
    name:    teamName,
    initial: tla?.slice(0, 2) || teamName[0] || '?',
    color:   '#374151',
    crest:   teamCrest,
  };
  const [isFollowed, toggleFollow] = useFollowing(teamObj);

  return (
    <button
      className={[styles.followBtn, isFollowed ? styles.active : ''].filter(Boolean).join(' ')}
      onClick={toggleFollow}
      aria-label={isFollowed ? 'Unfollow team' : 'Follow team'}
      title={isFollowed ? 'Unfollow' : 'Follow'}
    >
      <Icon name={isFollowed ? 'star-filled' : 'star'} size={18} />
    </button>
  );
}
