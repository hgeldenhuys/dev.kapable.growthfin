import { AlertTriangle, Ban, Flame } from 'lucide-react';

export function BrutalFeaturesAlt10() {
  return (
    <section className="py-20 border-b-[10px] border-black bg-[#D6FFF6]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-white border-[5px] border-black p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <Ban className="w-16 h-16 mb-6" />
            <h3 className="text-3xl font-black mb-4">NO HUMANS.</h3>
            <p className="text-xl font-bold font-mono">
              Humans get tired. Humans forget follow-ups. Humans quit.
              AI works 24/7/365 without complaining.
            </p>
          </div>

          <div className="bg-white border-[5px] border-black p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <Flame className="w-16 h-16 mb-6 text-red-600" />
            <h3 className="text-3xl font-black mb-4">NO BURNOUT.</h3>
            <p className="text-xl font-bold font-mono">
              SDR burnout is real. Stop churning through junior talent. 
              Let the machine do the grunt work.
            </p>
          </div>

          <div className="bg-white border-[5px] border-black p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <AlertTriangle className="w-16 h-16 mb-6 text-yellow-500" />
            <h3 className="text-3xl font-black mb-4">NO LAWSUITS.</h3>
            <p className="text-xl font-bold font-mono">
              "Is this legal?" Yes. Fully POPIA-compliant.
              We built this for South African compliance from day one.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
