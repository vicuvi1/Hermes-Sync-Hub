import { HealthStatusType } from '@hermes-hub/types';

export class HealthMonitorService {
  async checkHealth(): Promise<HealthStatusType> {
    return 'healthy';
  }
}
