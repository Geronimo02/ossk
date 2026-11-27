import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { COMMUNITY_POSTS, type CommunityPost } from '../data/catalog';
import { soundEngine } from '../utils/soundEngine';

interface CommunitySectionProps {
  onOpenLoupe: (productId: string) => void;
  onJumpToLook: (lookIndex: number) => void;
}

export function CommunitySection({ onOpenLoupe, onJumpToLook }: CommunitySectionProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleAction = (post: CommunityPost) => {
    soundEngine.playPop();
    if (post.actionType === 'loupe' && typeof post.targetId === 'string') {
      onOpenLoupe(post.targetId);
    } else if (post.actionType === 'runway' && typeof post.targetId === 'number') {
      onJumpToLook(post.targetId);
    }
  };

  return (
    <section id="comunidad" className="bg-white text-[#151413] py-16 md:py-24 border-t border-[#e4e4e4]">
      <div className="w-full max-w-[1440px] mx-auto px-5 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6 pb-8 border-b border-[#e4e4e4]">
          <div>
            <p className="m-0 font-mono-tech text-[11px] tracking-[0.2em] uppercase text-[#5e5a54]">
              03 · En el Local · Clientes
            </p>
            <h2 className="mt-2 mb-0 font-display text-[clamp(2.25rem,4.6vw,3.9rem)] font-extrabold leading-[0.94] uppercase text-balance">
              Probador, Alfombra y Flat-lays
            </h2>
          </div>

          <div className="flex flex-col sm:items-end gap-3">
            <p className="m-0 max-w-[42ch] text-[14px] leading-[1.55] text-[#5e5a54] sm:text-right">
              Así se ven las prendas en persona en Rodríguez 743: fit-checks reales en el espejo del local y outfits armados sobre cemento.
            </p>
            <a
              href="https://www.instagram.com/ossktandil/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono-tech text-[11px] font-bold tracking-[0.14em] uppercase text-[#d91e2a] hover:text-[#151413] transition-colors whitespace-nowrap"
            >
              <span>Ver más en @ossktandil</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {COMMUNITY_POSTS.map((post) => {
            const failed = failedImages[post.id];
            return (
              <article
                key={post.id}
                data-testid="community-card"
                className="group flex flex-col border border-[#e4e4e4] bg-white transition-colors duration-200 hover:border-[#151413]"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-[#eaeae6]">
                  {failed ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#ecece9] to-[#dfdfd9] text-[#5e5a54]">
                      <span className="font-mono-tech text-[10px] tracking-[0.18em] uppercase">
                        {post.tag}
                      </span>
                      <span className="mt-2 font-display text-xl font-extrabold uppercase text-[#151413]">
                        {post.title}
                      </span>
                    </div>
                  ) : (
                    <img
                      src={post.image}
                      alt={`${post.title} — Ossk Tandil`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={() => setFailedImages((prev) => ({ ...prev, [post.id]: true }))}
                      className="w-full h-full object-cover editorial-bw-soft transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                </div>

                <div className="p-4 flex flex-col justify-between flex-1 gap-4">
                  <div>
                    <p className="m-0 font-mono-tech text-[10px] tracking-[0.14em] uppercase text-[#5e5a54]">
                      {post.tag}
                    </p>
                    <h3 className="mt-1.5 mb-0 font-display text-[22px] font-extrabold leading-tight uppercase text-[#151413]">
                      {post.title}
                    </h3>
                    <p className="mt-1.5 mb-0 text-[13px] leading-[1.5] text-[#5e5a54]">
                      {post.caption}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAction(post)}
                    className="inline-flex items-center justify-between w-full min-h-[42px] px-3.5 border border-[#dcdcd8] bg-[#f5f5f3] text-[#151413] font-mono-tech text-[10.5px] font-bold tracking-[0.12em] uppercase whitespace-nowrap transition-colors hover:bg-[#151413] hover:border-[#151413] hover:text-white"
                  >
                    <span>{post.actionLabel}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
