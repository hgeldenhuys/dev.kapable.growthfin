import { Link } from 'react-router';
import { Github, Twitter, Linkedin } from 'lucide-react';

export function FooterAlt5() {
  return (
    <footer className="bg-black border-t border-zinc-900 py-20 text-white">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <h3 className="text-2xl font-black tracking-tighter mb-2">ACME CORP.</h3>
            <p className="text-gray-500 text-sm">© 2024 ACME CORP AI. All rights reserved.</p>
          </div>
          
          <div className="flex gap-6">
             <Link to="#" className="text-gray-500 hover:text-orange-500 transition-colors">
               <Twitter className="w-6 h-6" />
             </Link>
             <Link to="#" className="text-gray-500 hover:text-orange-500 transition-colors">
               <Github className="w-6 h-6" />
             </Link>
             <Link to="#" className="text-gray-500 hover:text-orange-500 transition-colors">
               <Linkedin className="w-6 h-6" />
             </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
