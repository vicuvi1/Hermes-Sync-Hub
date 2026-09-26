import React, { useEffect, useState } from 'react';
import { HermesSkill, Device } from '@hermes-hub/types';
import { formatTimeAgo } from '@hermes-hub/shared';
import { Sparkles, Search, Files, Laptop, CheckCircle2, Tag, ArrowUpRight } from 'lucide-react';

interface SkillsViewProps {
  skills: HermesSkill[];
  devices: Device[];
  initialSelectedSkillId?: string;
}

export const SkillsView: React.FC<SkillsViewProps> = ({ skills, devices, initialSelectedSkillId }) => {
  const [search, setSearch] = useState('');
  useEffect(() => { const requested = skills.find((skill) => skill.id === initialSelectedSkillId); if (requested) setSearch(requested.name); }, [initialSelectedSkillId, skills]);

  const filteredSkills = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Search Header */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search agent skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSkills.map((skill) => (
          <div
            key={skill.id}
            className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur-sm shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base">{skill.name}</h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      Revision #{skill.revision}
                    </div>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Synced</span>
                </span>
              </div>

              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                {skill.description}
              </p>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground flex items-center gap-1"
                  >
                    <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-mono">
                  <Files className="h-3.5 w-3.5" />
                  <span>{skill.filesCount} files</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Laptop className="h-3.5 w-3.5" />
                  <span>{skill.originDeviceName}</span>
                </span>
              </div>
              <span>{formatTimeAgo(skill.lastModified)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
